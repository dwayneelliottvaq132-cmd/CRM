import datetime as dt

from sqlalchemy.orm import Session

from app.models.compliance import NCR
from app.models.job import Job
from app.services import audit_service, webhook_service


def create(
    db: Session,
    *,
    ncr_id: str,
    reference_label: str,
    disposition: str,
    description: str,
    actor: str,
    job_id: str | None = None,
    tank_id: str | None = None,
) -> NCR:
    ncr = NCR(
        id=ncr_id,
        job_id=job_id,
        tank_id=tank_id,
        reference_label=reference_label,
        opened_at=dt.date.today(),
        disposition=disposition,
        description=description,
    )
    db.add(ncr)

    if job_id:
        job = db.get(Job, job_id)
        if job is not None:
            job.status = "Hold — NCR"

    db.flush()
    audit_service.record(db, actor=actor, action="open_ncr", entity_type="ncr", entity_id=ncr.id, after={"job_id": job_id, "disposition": disposition})
    webhook_service.dispatch(db, topic="ncr.opened", payload={"ncr_id": ncr.id, "job_id": job_id, "description": description})
    return ncr
