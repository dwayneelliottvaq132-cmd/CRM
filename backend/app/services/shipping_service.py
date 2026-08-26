import datetime as dt

from sqlalchemy.orm import Session

from app.models.job import Job, SpecResult
from app.services import audit_service, webhook_service
from app.services.exceptions import BusinessRuleError, NotFoundError


def ship_job(db: Session, *, job_id: str, actor: str) -> Job:
    """Ship a job. Server-side rule: shipping is blocked while any operation is
    unsigned, the job is on NCR hold, or a failed spec result is unresolved
    (not superseded by a passing re-test and not explicitly dispositioned)."""
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} not found")

    blockers = job.ship_blockers
    if blockers:
        raise BusinessRuleError(f"Cannot ship {job_id}: " + "; ".join(blockers))

    before_status = job.status
    job.status = "Shipped"
    db.flush()

    audit_service.record(
        db, actor=actor, action="ship_job", entity_type="job", entity_id=job.id,
        before={"status": before_status}, after={"status": "Shipped"},
    )
    webhook_service.dispatch(
        db, topic="job.status_changed", payload={"job_id": job.id, "from": before_status, "to": "Shipped"}
    )
    return job


def resolve_spec_result(db: Session, *, job_id: str, result_id: int, note: str, actor: str) -> SpecResult:
    """MRB-style disposition of a failed spec result — quality role only (enforced at the API)."""
    result = db.get(SpecResult, result_id)
    if result is None or result.job_id != job_id:
        raise NotFoundError(f"Spec result {result_id} not found on job {job_id}")
    if result.passed:
        raise BusinessRuleError("Only failed spec results need resolution")
    if result.resolved_at is not None:
        raise BusinessRuleError("This spec result is already resolved")
    if not note or len(note.strip()) < 10:
        raise BusinessRuleError("A disposition note (at least 10 characters) is required to resolve a failed spec")

    result.resolved_by = actor
    result.resolved_at = dt.datetime.now(dt.timezone.utc)
    result.resolution_note = note.strip()
    db.flush()

    audit_service.record(
        db, actor=actor, action="resolve_spec_result", entity_type="spec_result", entity_id=str(result.id),
        after={"job_id": job_id, "name": result.name, "resolution_note": result.resolution_note},
    )
    return result
