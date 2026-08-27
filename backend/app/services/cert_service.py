import datetime as dt

from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.job import Job
from app.services import audit_service
from app.services.exceptions import BusinessRuleError, NotFoundError


def readiness(job: Job) -> tuple[bool, str]:
    """Returns (ready, reason). Mirrors the mockup rule: C of C can't be issued if any
    operation is unsigned, or if a tank an operation ran through was out of control
    at the time it was signed (or is currently held, as an extra live safety check)."""
    for op in job.ops:
        if op.tank is not None and (op.tank_ooc_at_signoff or op.tank.held):
            return False, f"Blocked — {op.tank.id} OOC"
        if op.has_out_of_spec_reading:
            return False, f"Blocked — out-of-spec reading on op {op.seq} ({op.name})"
    failed = job.unresolved_failed_specs()
    if failed:
        return False, f"Blocked — failed spec: {failed[0].name}"
    if not job.all_ops_done():
        unsigned = sum(1 for o in job.ops if not o.done)
        if job.current_op() and job.current_op().name == "Final Inspect":
            return False, "Awaiting final insp."
        return False, f"{unsigned} operation(s) unsigned"
    return True, "Ready to issue"


def issue(db: Session, *, job_id: str, cert_id: str, actor: str) -> Certificate:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} not found")

    ready, reason = readiness(job)
    if not ready:
        raise BusinessRuleError(f"Cannot issue C of C for {job_id}: {reason}")

    cert = db.get(Certificate, cert_id)
    if cert is None:
        cert = Certificate(
            id=cert_id,
            job_id=job.id,
            qty_accepted=job.qty,
            process_text=f"{job.process_label} — {job.spec}",
        )
        db.add(cert)

    cert.issued = True
    cert.issued_at = dt.datetime.utcnow()
    cert.issued_by = actor
    cert.blocked_reason = None

    # Freeze a traceability snapshot at issue time so the released C of C is immutable and
    # doesn't drift if the job is later edited (AS9100 §8.5.2 / §7.5.3).
    cert.material_lot = job.material_lot
    cert.part_number = job.part_number
    cert.revision = job.revision
    cert.spec = job.spec
    cert.routing_revision_label = job.source_routing_revision_label
    cert.recorded_readings = [
        {
            "op_seq": op.seq, "op_name": op.name, "label": r.get("label"), "value": r.get("value"),
            "unit": r.get("unit", ""), "in_spec": r.get("in_spec"),
            "recorded_by": r.get("recorded_by"), "recorded_at": r.get("recorded_at"),
        }
        for op in job.ops
        for r in (op.recorded_parameters or [])
    ]
    db.flush()

    audit_service.record(
        db, actor=actor, action="issue_certificate", entity_type="certificate", entity_id=cert.id,
        after={"job_id": job.id, "qty_accepted": cert.qty_accepted},
    )
    return cert
