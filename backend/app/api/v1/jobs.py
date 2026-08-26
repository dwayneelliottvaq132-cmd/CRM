import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.models.customer import Customer
from app.models.job import Job
from app.models.user import User
from app.models.compliance import NCR
from app.schemas.job import BatchSignoffRequest, JobCreate, JobDetailOut, JobOut, JobUpdate, OperatorOut, PinRequest, ReportProblemRequest, ResolveSpecRequest, SignoffRequest, SpecResultOut
from app.services import audit_service, id_service, ncr_service, routing_service, shipping_service, signoff_service
from app.services.exceptions import BusinessRuleError, NotFoundError

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(get_current_user)])


def _job_query():
    return select(Job).options(selectinload(Job.customer), selectinload(Job.ops), selectinload(Job.spec_results))


@router.get("", response_model=list[JobOut])
def list_jobs(status: str | None = None, planning_status: str | None = None, db: Session = Depends(get_db)) -> list[Job]:
    stmt = _job_query()
    if status:
        stmt = stmt.where(Job.status == status)
    if planning_status:
        stmt = stmt.where(Job.planning_status == planning_status)
    return db.execute(stmt.order_by(Job.due_date.asc().nulls_last())).scalars().all()


@router.post("", response_model=JobDetailOut, status_code=201)
def create_job(body: JobCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    """Create a job traveler directly (outside the order/quote conversion flow). Created
    with no operations yet — the job lands in planning_status="Needs Planning" and sits
    in the Planning module's queue until a person explicitly applies a plan."""
    customer = db.get(Customer, body.customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")

    job_id = id_service.next_id(db, Job, f"J-{dt.date.today():%y}", 3)
    job = Job(
        id=job_id,
        customer_id=body.customer_id,
        customer_po=body.customer_po,
        part_number=body.part_number,
        revision=body.revision,
        qty=body.qty,
        material_lot=f"L-{dt.date.today():%y%m%d}",
        process_label=body.process_label or body.spec.split(" ")[0],
        spec=body.spec,
        due_date=body.due_date,
        itar=body.itar,
        status="Queued",
        planning_status="Needs Planning",
    )
    db.add(job)
    db.flush()
    audit_service.record(db, actor=user.name, action="create", entity_type="job", entity_id=job_id, after=body.model_dump(mode="json"))
    db.commit()
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.post("/{job_id}/complete-planning/apply-plan", response_model=JobDetailOut)
def complete_planning_apply_plan(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    """Planning module: 'Apply Released Plan' — clones the part's current Released
    routing plan onto this job."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    try:
        routing_service.apply_released_plan_to_job(db, job=job, actor=user.name)
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=user.name, action="complete_planning", entity_type="job", entity_id=job_id, after={"method": "apply_released_plan"})
    db.commit()
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.post("/{job_id}/complete-planning/placeholder", response_model=JobDetailOut)
def complete_planning_placeholder(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    """Planning module: 'Proceed Without a Formal Plan' — seeds a single default step.
    Blocked for customers that require an approved routing plan."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    try:
        routing_service.apply_placeholder_plan_to_job(db, job=job, actor=user.name)
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=user.name, action="complete_planning", entity_type="job", entity_id=job_id, after={"method": "placeholder"})
    db.commit()
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.get("/operator-by-pin", response_model=OperatorOut)
def operator_by_pin(pin: str, db: Session = Depends(get_db)) -> User:
    """Resolves a shop-floor PIN to just the operator's name — used by the kiosk scan
    station to greet whoever badged in without exposing anything else about the account
    or completing any operation (see signoff_service.find_operator_by_pin). Declared
    before /{job_id} below so 'operator-by-pin' isn't swallowed as a job id — Starlette
    matches routes in registration order."""
    operator = signoff_service.find_operator_by_pin(db, pin)
    if operator is None:
        raise HTTPException(404, "PIN not recognized")
    db.commit()  # persists a pin_lookup_hash backfill if find_operator_by_pin set one
    return operator


@router.get("/{job_id}", response_model=JobDetailOut)
def get_job(job_id: str, db: Session = Depends(get_db)) -> Job:
    job = db.execute(_job_query().where(Job.id == job_id)).scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/{job_id}/traveler", response_model=JobDetailOut)
def get_traveler(job_id: str, db: Session = Depends(get_db)) -> Job:
    return get_job(job_id, db)


@router.patch("/{job_id}", response_model=JobDetailOut)
def update_job(job_id: str, body: JobUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(job, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="job", entity_id=job_id, after=changes)
    db.commit()
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Only deletable while still Queued with nothing signed off and no spec results
    recorded — once real activity exists on a traveler, it stays for the audit trail."""
    job = db.execute(_job_query().where(Job.id == job_id)).scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job not found")
    if job.status != "Queued" or any(op.done for op in job.ops) or job.spec_results:
        raise HTTPException(409, "Cannot delete a job with recorded activity — it must stay Queued with no signed operations or spec results.")
    audit_service.record(db, actor=user.name, action="delete", entity_type="job", entity_id=job_id, before={"part_number": job.part_number, "customer_po": job.customer_po})
    try:
        db.delete(job)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Cannot delete: this job is referenced by an order, certificate, invoice, or NCR.")


@router.post("/{job_id}/ops/{seq}/start", response_model=JobDetailOut)
def start_op(job_id: str, seq: int, body: PinRequest, db: Session = Depends(get_db)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    current = job.current_op()
    if current is None and job.planning_status == "Needs Planning":
        raise HTTPException(409, "This job has not completed Planning yet — no operations exist. Complete Planning first.")
    if current is None or current.seq != seq:
        raise HTTPException(409, "That is not the current operation for this job")
    try:
        job, _op, _operator = signoff_service.start_op(db, job_id=job_id, pin=body.pin)
        db.commit()
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.post("/{job_id}/ship", response_model=JobDetailOut)
def ship_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Job:
    """Ship a completed job. Blocked server-side while any op is unsigned, the job
    is on NCR hold, or an unresolved FAILED spec result exists on the traveler."""
    try:
        shipping_service.ship_job(db, job_id=job_id, actor=user.name)
        db.commit()
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.post("/{job_id}/spec-results/{result_id}/resolve", response_model=SpecResultOut)
def resolve_spec_result(
    job_id: str,
    result_id: int,
    body: ResolveSpecRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("Quality Manager")),
) -> object:
    """Disposition a failed spec result (MRB-style). Quality Manager only."""
    try:
        result = shipping_service.resolve_spec_result(db, job_id=job_id, result_id=result_id, note=body.note, actor=user.name)
        db.commit()
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    return result


@router.post("/{job_id}/ops/{seq}/signoff", response_model=JobDetailOut)
def signoff_op(job_id: str, seq: int, body: SignoffRequest, db: Session = Depends(get_db)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    current = job.current_op()
    if current is None and job.planning_status == "Needs Planning":
        raise HTTPException(409, "This job has not completed Planning yet — no operations exist. Complete Planning first.")
    if current is None or current.seq != seq:
        raise HTTPException(409, "That is not the current operation for this job")
    try:
        job, _op, _operator = signoff_service.complete_op(db, job_id=job_id, pin=body.pin, readings=body.readings)
        db.commit()
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()


@router.get("/{job_id}/batch-candidates", response_model=list[JobOut])
def batch_candidates(job_id: str, db: Session = Depends(get_db)) -> list[Job]:
    """Other open jobs sharing this job's current tank/equipment + operation name —
    candidates to batch sign off together (e.g. a whole rack pulled from one tank)."""
    try:
        return signoff_service.find_batch_candidates(db, job_id=job_id)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/batch/signoff", response_model=list[JobDetailOut])
def batch_signoff(body: BatchSignoffRequest, db: Session = Depends(get_db)) -> list[Job]:
    """All-or-nothing batch sign-off across several jobs sharing one process step —
    see signoff_service.batch_complete for the validate-everything-then-mutate-
    everything semantics."""
    try:
        jobs, _operator = signoff_service.batch_complete(db, job_ids=body.job_ids, pin=body.pin, readings=body.readings)
        db.commit()
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    job_ids = [j.id for j in jobs]
    rows = db.execute(_job_query().where(Job.id.in_(job_ids))).scalars().all()
    by_id = {r.id: r for r in rows}
    return [by_id[jid] for jid in job_ids]


@router.post("/{job_id}/report-problem", response_model=JobDetailOut, status_code=201)
def report_problem(job_id: str, body: ReportProblemRequest, db: Session = Depends(get_db)) -> Job:
    """Shop-floor operator flags nonconforming product: opens an NCR (disposition
    'Open — MRB', pending Quality review) and puts the job on 'Hold — NCR' so no further
    operation can be signed until Quality lifts the hold (AS9100 §8.7). Attributed to the
    operator via PIN, same as sign-off."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if not body.description.strip():
        raise HTTPException(422, "A description of the problem is required")
    operator = signoff_service.find_operator_by_pin(db, body.pin)
    if operator is None:
        raise HTTPException(400, "PIN not recognized")

    ncr_id = id_service.next_id(db, NCR, f"NCR-{dt.date.today():%y}-", 3)
    ncr_service.create(
        db, ncr_id=ncr_id, reference_label=job_id, disposition="Open — MRB",
        description=body.description.strip(), actor=operator.name, job_id=job_id,
    )
    db.commit()
    return db.execute(_job_query().where(Job.id == job_id)).scalar_one()
