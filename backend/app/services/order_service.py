"""Order → work-order creation and the AS9100 §8.2.3 contract-review gate.

Unifies the two job-creation paths that previously duplicated this logic: the manual
"convert order to job" endpoint and the per-line loop in
purchase_order_analysis_service.generate_sales_order. Both now go through
create_work_orders_for_order()."""

import datetime as dt

from sqlalchemy.orm import Session

from app.models.contract_review import ContractReview
from app.models.customer import Customer
from app.models.job import Job
from app.models.order import Order, OrderLine
from app.services import id_service
from app.services.exceptions import BusinessRuleError


def require_contract_review_passed(order: Order) -> None:
    """AS9100 §8.2.3 gate: a customer flagged requires_contract_review cannot have an order
    turned into a work order until its ContractReview outcome is 'Accepted'."""
    if not (order.customer and order.customer.requires_contract_review):
        return
    review = order.contract_review
    if review is None or review.outcome != "Accepted":
        raise BusinessRuleError(
            f"Contract review required for {order.customer.name} before creating a work order — "
            f"complete and accept the contract review for order {order.id} first (AS9100 §8.2.3)."
        )


def _build_job_from_line(
    db: Session, *, order: Order, customer: Customer, part_number: str, revision: str,
    spec: str, qty: int, due_date, po_requirements: list | None, order_line: OrderLine | None,
    source_drawing_analysis_id: int | None = None,
) -> Job:
    """Creates the Job with no operations yet — routing is no longer resolved here.
    The job lands in planning_status="Needs Planning" and sits in the Planning
    module's queue until a person explicitly applies a plan (see routing_service.
    apply_released_plan_to_job / apply_placeholder_plan_to_job)."""
    job_id = id_service.next_id(db, Job, f"J-{dt.date.today():%y}", 3)
    job = Job(
        id=job_id, customer_id=customer.id, customer_po=order.customer_po,
        part_number=part_number, revision=revision, qty=qty,
        material_lot=f"L-{dt.date.today().strftime('%y%m%d')}",
        process_label=spec.split(" ")[0] if spec else "TBD",
        spec=spec, due_date=due_date, status="Queued",
        planning_status="Needs Planning",
        source_drawing_analysis_id=source_drawing_analysis_id,
        po_requirements=po_requirements,
    )
    db.add(job)
    db.flush()
    if order_line is not None:
        order_line.job_id = job_id
    return job


def create_work_orders_for_order(db: Session, *, order: Order, actor: str) -> list[Job]:
    """Create work orders for an order: one Job per OrderLine if the order has lines
    (PO-sourced multi-line), else one Job from the order's flat fields (manual single-part).
    Reuses routing_service.resolve_routing_for_job so approved-plan resolution and the
    graceful 'no plan' fallback are identical across both paths.

    Enforces the contract-review gate first, and can raise BusinessRuleError from routing
    resolution (e.g. customer.require_approved_routing with no released plan)."""
    require_contract_review_passed(order)
    customer = order.customer

    # PO general requirements captured on the review flow onto every line's job.
    base_reqs: list = []
    if order.contract_review and order.contract_review.captured_requirements:
        base_reqs = list(order.contract_review.captured_requirements)

    jobs: list[Job] = []
    if order.lines:
        for line in order.lines:
            if line.job_id:  # already converted
                continue
            job = _build_job_from_line(
                db, order=order, customer=customer, part_number=line.part_number or order.part_number,
                revision=line.revision or "A", spec=line.spec or order.spec, qty=line.qty,
                due_date=order.due_date, po_requirements=base_reqs or None, order_line=line,
            )
            jobs.append(job)
    else:
        job = _build_job_from_line(
            db, order=order, customer=customer, part_number=order.part_number, revision="A",
            spec=order.spec, qty=order.qty, due_date=order.due_date,
            po_requirements=base_reqs or None, order_line=None,
        )
        jobs.append(job)

    order.status = "Converted"
    if len(jobs) == 1:
        order.converted_job_id = jobs[0].id
    db.flush()
    return jobs


def get_or_create_review(db: Session, order: Order) -> ContractReview:
    """Return the order's contract review, creating a Pending one (seeded from the order's
    spec and any linked-PO requirements) on first access."""
    if order.contract_review is not None:
        return order.contract_review
    captured: list = []
    if order.purchase_order_analysis_id:
        from app.models.purchase_order import PurchaseOrderAnalysis
        po = db.get(PurchaseOrderAnalysis, order.purchase_order_analysis_id)
        if po:
            captured = list(po.general_requirements or [])
            for item in (po.line_items or []):
                captured.extend(item.get("line_requirements") or [])
    review = ContractReview(
        order_id=order.id, governing_spec=order.spec, spec_revision="",
        captured_requirements=captured or None, outcome="Pending",
    )
    db.add(review)
    db.flush()
    return review
