import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.contract_review import ContractReview
from app.models.customer import Customer
from app.models.job import Job
from app.models.order import Order
from app.models.user import User
from app.schemas.job import JobOut
from app.schemas.order import ContractReviewOut, ContractReviewUpdate, OrderCreate, OrderOut, OrderUpdate
from app.services import audit_service, id_service, order_service
from app.services.exceptions import BusinessRuleError

router = APIRouter(prefix="/orders", tags=["orders"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)) -> list[Order]:
    return db.execute(select(Order).options(selectinload(Order.customer)).order_by(Order.id.desc())).scalars().all()


@router.post("", response_model=OrderOut, status_code=201)
def create_order(body: OrderCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Order:
    if db.get(Customer, body.customer_id) is None:
        raise HTTPException(404, "Customer not found")

    order_id = body.id
    if order_id:
        if db.get(Order, order_id):
            raise HTTPException(409, f"Order {order_id} already exists")
    else:
        prefix = "QT-" if body.kind == "quote" else "SO-"
        order_id = id_service.next_id(db, Order, f"{prefix}{dt.date.today():%y}-", 4)

    order = Order(**{**body.model_dump(exclude={"id"}), "id": order_id})
    db.add(order)
    db.flush()
    audit_service.record(db, actor=user.name, action="create", entity_type="order", entity_id=order.id, after=body.model_dump(mode="json"))
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(order_id: str, body: OrderUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(order, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="order", entity_id=order_id, after=changes)
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Only deletable while nothing has been built on it yet — once converted to a
    job, cancel/rework happens through the job/NCR workflow instead."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.converted_job_id:
        raise HTTPException(409, f"Cannot delete: already converted to job {order.converted_job_id}")
    audit_service.record(db, actor=user.name, action="delete", entity_type="order", entity_id=order_id, before={"part_number": order.part_number, "customer_po": order.customer_po})
    db.delete(order)
    db.commit()


@router.post("/{order_id}/convert", response_model=JobOut)
def convert_to_job(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.converted_job_id:
        raise HTTPException(409, f"Order already converted to {order.converted_job_id}")

    try:
        jobs = order_service.create_work_orders_for_order(db, order=order, actor=user.name)
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc

    audit_service.record(db, actor=user.name, action="convert_order", entity_type="order", entity_id=order.id,
                         after={"job_ids": [j.id for j in jobs]})
    db.commit()
    db.refresh(jobs[0])
    return jobs[0]


@router.get("/{order_id}/contract-review", response_model=ContractReviewOut)
def get_contract_review(order_id: str, db: Session = Depends(get_db)) -> ContractReview:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    review = order_service.get_or_create_review(db, order)
    db.commit()
    return review


@router.put("/{order_id}/contract-review", response_model=ContractReviewOut)
def save_contract_review(order_id: str, body: ContractReviewUpdate, db: Session = Depends(get_db),
                         user: User = Depends(get_current_user)) -> ContractReview:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    review = order_service.get_or_create_review(db, order)
    if review.outcome == "Accepted":
        raise HTTPException(409, "Contract review is already Accepted and cannot be edited")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="save_contract_review", entity_type="contract_review",
                         entity_id=str(review.id), after=body.model_dump(exclude_unset=True))
    db.commit()
    return review


@router.post("/{order_id}/contract-review/accept", response_model=JobOut)
def accept_contract_review(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    review = order_service.get_or_create_review(db, order)
    if order.converted_job_id or (order.lines and all(l.job_id for l in order.lines)):
        raise HTTPException(409, "Order has already been converted to work order(s)")
    if not review.all_checked():
        raise HTTPException(422, "Every contract-review item must be confirmed before the order can be accepted.")

    review.outcome = "Accepted"
    review.reviewed_by = user.name
    review.reviewed_at = dt.datetime.utcnow()
    db.flush()
    try:
        jobs = order_service.create_work_orders_for_order(db, order=order, actor=user.name)
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=user.name, action="accept_contract_review", entity_type="order",
                         entity_id=order.id, after={"job_ids": [j.id for j in jobs]})
    db.commit()
    db.refresh(jobs[0])
    return jobs[0]


@router.post("/{order_id}/contract-review/reject", response_model=ContractReviewOut)
def reject_contract_review(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ContractReview:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    review = order_service.get_or_create_review(db, order)
    review.outcome = "Rejected"
    review.reviewed_by = user.name
    review.reviewed_at = dt.datetime.utcnow()
    db.flush()
    audit_service.record(db, actor=user.name, action="reject_contract_review", entity_type="order", entity_id=order.id)
    db.commit()
    return review
