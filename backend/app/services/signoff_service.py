import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_pin_lookup, verify_secret
from app.models.job import Job, JobOperation
from app.models.user import User
from app.schemas.job import ParameterReading
from app.services import audit_service, webhook_service
from app.services.exceptions import BusinessRuleError, NotFoundError


def find_operator_by_pin(db: Session, pin: str) -> User | None:
    """Resolves a shop-floor PIN to its operator. Fast path first: an indexed exact
    match on pin_lookup_hash (sha256), O(1) — falls back to the original bcrypt scan
    only for an operator who hasn't matched via the fast path yet (e.g. a pre-existing
    account from before pin_lookup_hash existed), and self-heals by backfilling
    pin_lookup_hash on that verified match so this operator's next lookup is O(1) too.
    Bcrypt is deliberately slow (fine for a login password) — verifying it against every
    active operator in sequence made this take seconds once there were 15-20+ operators,
    which is fatal for a scan/kiosk workflow where this runs on every start/sign-off."""
    if not pin or len(pin) < 4:
        return None
    lookup = hash_pin_lookup(pin)
    fast_match = db.execute(
        select(User).where(User.pin_lookup_hash == lookup, User.is_active.is_(True))
    ).scalar_one_or_none()
    if fast_match is not None:
        return fast_match
    operators = db.execute(select(User).where(User.pin_hash.is_not(None), User.is_active.is_(True))).scalars().all()
    for op in operators:
        if verify_secret(pin, op.pin_hash):
            op.pin_lookup_hash = lookup
            db.flush()
            return op
    return None


def _recompute_status(job: Job) -> str:
    if job.status == "Hold — NCR":
        return job.status  # holds are lifted explicitly via compliance, not by op progress
    if job.all_ops_done():
        return "Complete"
    done_count = sum(1 for o in job.ops if o.done)
    current = job.current_op()
    if current and (current.name == "Final Inspect" or current.is_final_inspect) and done_count == len(job.ops) - 1:
        return "Final Inspect"
    if done_count > 0:
        return "In Process"
    return "Queued"


def start_op(db: Session, *, job_id: str, pin: str) -> tuple[Job, JobOperation, User]:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} not found")
    _check_job_hold(job)
    _check_planning_complete(job)
    operator = find_operator_by_pin(db, pin)
    if operator is None:
        raise BusinessRuleError("PIN not recognized")

    op = job.current_op()
    if op is None:
        raise BusinessRuleError("All operations already complete")

    _check_blockers(op)
    op.started_at = dt.datetime.utcnow()
    db.flush()
    return job, op, operator


def _validate_job_ready_for_signoff(job: Job) -> JobOperation:
    """The per-job gate checks that must pass before a sign-off can proceed: not on
    hold, planning complete, has a current op, and that op isn't blocked. Shared by
    complete_op (single) and batch_complete (all-or-nothing across several jobs) so
    the two paths can never drift apart on what makes a job signable."""
    _check_job_hold(job)
    _check_planning_complete(job)
    op = job.current_op()
    if op is None:
        raise BusinessRuleError(f"Job {job.id}: all operations already complete")
    _check_blockers(op)
    return op


def _apply_completion(job: Job, op: JobOperation, recorded: list[dict], *, actor: str) -> str:
    """The state-mutating half of sign-off, applied only after validation has fully
    passed (see complete_op / batch_complete) — split out so a batch sign-off can
    validate every job first and only then mutate any of them (all-or-nothing).
    Returns the job's status before this change, for webhook diffing."""
    before_status = job.status
    op.done = True
    op.signed_by = actor
    op.signed_at = dt.datetime.utcnow()
    op.tank_ooc_at_signoff = bool(op.tank and op.tank.held)
    op.recorded_parameters = recorded
    op.has_out_of_spec_reading = any(r["in_spec"] is False for r in recorded)
    job.status = _recompute_status(job)
    return before_status


def complete_op(db: Session, *, job_id: str, pin: str, readings: list[ParameterReading] | None = None) -> tuple[Job, JobOperation, User]:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} not found")
    op = _validate_job_ready_for_signoff(job)
    operator = find_operator_by_pin(db, pin)
    if operator is None:
        raise BusinessRuleError("PIN not recognized")

    recorded = _resolve_and_validate_readings(op, readings or [], actor=operator.name)
    before_status = _apply_completion(job, op, recorded, actor=operator.name)
    db.flush()

    audit_service.record(
        db,
        actor=operator.name,
        action="signoff",
        entity_type="job_operation",
        entity_id=str(op.id),
        after={
            "job_id": job.id, "op_seq": op.seq, "op_name": op.name, "signed_by": operator.name,
            "recorded_parameters": recorded, "has_out_of_spec_reading": op.has_out_of_spec_reading,
        },
    )
    if before_status != job.status:
        webhook_service.dispatch(
            db, topic="job.status_changed", payload={"job_id": job.id, "from": before_status, "to": job.status}
        )
    return job, op, operator


def find_batch_candidates(db: Session, *, job_id: str) -> list[Job]:
    """Other open jobs whose current operation shares this job's tank (or equipment,
    if no tank) and operation name — the real-world "same rack/load" signal. Only
    already-individually-eligible jobs are returned (would pass the same hold/
    planning/blocker gates complete_op enforces), so anything the batch UI offers
    is guaranteed signable on its own already."""
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} not found")
    op = job.current_op()
    if op is None or (op.tank_id is None and op.equipment_id is None):
        return []

    others = db.execute(
        select(Job)
        .options(
            selectinload(Job.ops).selectinload(JobOperation.tank),
            selectinload(Job.ops).selectinload(JobOperation.equipment),
        )
        .where(Job.status.notin_(["Complete", "Shipped"]), Job.id != job.id)
    ).scalars().all()

    candidates: list[Job] = []
    for other in others:
        other_op = other.current_op()
        if other_op is None or other_op.name != op.name:
            continue
        if op.tank_id is not None:
            if other_op.tank_id != op.tank_id:
                continue
        elif other_op.equipment_id != op.equipment_id:
            continue
        try:
            _validate_job_ready_for_signoff(other)
        except BusinessRuleError:
            continue
        candidates.append(other)
    return candidates


def batch_complete(db: Session, *, job_ids: list[str], pin: str, readings: list[ParameterReading] | None = None) -> tuple[list[Job], User]:
    """All-or-nothing batch sign-off: every job is independently validated (hold,
    planning, current op, blockers, and its own required_parameters resolved against
    the *same* submitted readings) before anything is mutated — if any job fails,
    none of them are touched. One operator PIN covers the whole batch, but each job
    still gets its own signed_by/signed_at/recorded_parameters row, exactly as if
    signed individually: batching only changes how the action was triggered, not
    what gets recorded (cert_service reads per-job JobOperation rows directly and
    must see complete, independent per-job data)."""
    if not job_ids:
        raise BusinessRuleError("No jobs selected for batch sign-off")
    operator = find_operator_by_pin(db, pin)
    if operator is None:
        raise BusinessRuleError("PIN not recognized")

    readings = readings or []
    prepared: list[tuple[Job, JobOperation, list[dict]]] = []
    for job_id in job_ids:
        job = db.get(Job, job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found")
        op = _validate_job_ready_for_signoff(job)
        recorded = _resolve_and_validate_readings(op, readings, actor=operator.name)
        prepared.append((job, op, recorded))

    results: list[Job] = []
    for job, op, recorded in prepared:
        before_status = _apply_completion(job, op, recorded, actor=operator.name)
        results.append(job)
        audit_service.record(
            db, actor=operator.name, action="signoff", entity_type="job_operation", entity_id=str(op.id),
            after={
                "job_id": job.id, "op_seq": op.seq, "op_name": op.name, "signed_by": operator.name,
                "recorded_parameters": recorded, "has_out_of_spec_reading": op.has_out_of_spec_reading,
                "batch": True,
            },
        )
        if before_status != job.status:
            webhook_service.dispatch(
                db, topic="job.status_changed", payload={"job_id": job.id, "from": before_status, "to": job.status}
            )
    db.flush()

    first_op = prepared[0][1]
    audit_service.record(
        db, actor=operator.name, action="batch_signoff", entity_type="job_operation_batch",
        entity_id=",".join(job_ids),
        after={"job_ids": job_ids, "tank_id": first_op.tank_id, "equipment_id": first_op.equipment_id, "op_name": first_op.name},
    )
    return results, operator


def _check_job_hold(job: Job) -> None:
    """A job on NCR hold must not accept any further op start/sign-off until Quality
    lifts the hold — the hold otherwise only blocks shipping (Job.ship_blockers), which
    would let processing continue on nonconforming product."""
    if job.status == "Hold — NCR":
        raise BusinessRuleError("Job is on NCR hold — operations cannot be signed until Quality lifts the hold.")


def _check_planning_complete(job: Job) -> None:
    """A job with planning_status "Needs Planning" has no operations yet — defense in
    depth alongside the router-level current_op() is None pre-check in jobs.py, for any
    other call path into this service."""
    if job.planning_status == "Needs Planning":
        raise BusinessRuleError(
            f"Job {job.id} has not completed Planning — no traveler operations exist yet. "
            f"Complete Planning for this job before shop-floor work can begin."
        )


def _check_blockers(op: JobOperation) -> None:
    if op.tank is not None and op.tank.held:
        raise BusinessRuleError(
            f"Tank {op.tank.id} is HELD — out of control ({op.tank.hold_reason or 'pending re-analysis'}). "
            f"Sign-off is blocked until the tank clears."
        )
    if op.tank is not None and op.tank.next_due_at is not None:
        # next_due_at is a TIMESTAMPTZ column but this codebase writes naive utcnow() —
        # normalize to naive before comparing (same gotcha as _resolve_and_validate_readings).
        due = op.tank.next_due_at.replace(tzinfo=None) if op.tank.next_due_at.tzinfo else op.tank.next_due_at
        if due < dt.datetime.utcnow():
            raise BusinessRuleError(
                f"Tank {op.tank.id} solution analysis is OVERDUE (was due {due:%Y-%m-%d}) — "
                f"AC7108 solution control requires a current analysis before processing. "
                f"Log a fresh analysis to clear."
            )
    if op.equipment is not None and op.equipment.is_overdue():
        raise BusinessRuleError(
            f"Equipment {op.equipment.id} ({op.equipment.name}) calibration is OVERDUE. "
            f"Sign-off is blocked until it is recalibrated."
        )


def _evaluate_reading(defn: dict, raw_value: float | str) -> tuple[float | str, bool | None]:
    """Mirrors Tank.in_control's min/max check. Returns (normalized_value, in_spec) —
    in_spec is None when the definition gives nothing to check against (a text kind
    with no target_text is recorded for information only, never judged)."""
    kind = defn.get("kind", "numeric")
    if kind in ("numeric", "duration"):
        value = float(raw_value)
        lo, hi = defn.get("target_min"), defn.get("target_max")
        in_spec = not ((lo is not None and value < lo) or (hi is not None and value > hi))
        return value, in_spec
    target_text = defn.get("target_text")
    value = str(raw_value)
    return value, (value.strip() == target_text.strip() if target_text else None)


def _resolve_and_validate_readings(op: JobOperation, submitted: list[ParameterReading], *, actor: str) -> list[dict]:
    """Resolves each of op.required_parameters against the submitted readings (or an
    auto-computed duration from the Start/Signoff clock), evaluating in-spec status.
    A missing or out-of-spec REQUIRED reading raises before any state is mutated —
    sign-off is hard-blocked, the same way a held tank or overdue equipment blocks it."""
    by_key = {r.key: r.value for r in submitted}
    now = dt.datetime.utcnow()
    resolved: list[dict] = []
    for defn in op.required_parameters or []:
        key, label, required = defn["key"], defn["label"], defn.get("required", True)
        if defn.get("auto_computed") and defn.get("kind") == "duration":
            if op.started_at is None:
                raise BusinessRuleError(f"Cannot auto-compute '{label}' — this operation was never started.")
            # started_at may come back tz-aware from a TIMESTAMPTZ column even though this
            # codebase writes naive utcnow() values — normalize before subtracting.
            started_at = op.started_at.replace(tzinfo=None) if op.started_at.tzinfo else op.started_at
            raw_value: float | str = (now - started_at).total_seconds() / 60
        elif key in by_key:
            raw_value = by_key[key]
        elif required:
            raise BusinessRuleError(f"Missing required reading for '{label}'")
        else:
            continue  # optional and not submitted — nothing to record

        value, in_spec = _evaluate_reading(defn, raw_value)
        if required and in_spec is False:
            target = f"{defn.get('target_min')}–{defn.get('target_max')}" if defn.get("kind") in ("numeric", "duration") else defn.get("target_text")
            raise BusinessRuleError(
                f"'{label}' reading {value}{defn.get('unit', '')} is out of spec (target {target}) — sign-off is blocked."
            )
        resolved.append({
            "key": key, "label": label, "unit": defn.get("unit", ""), "kind": defn.get("kind", "numeric"),
            "value": value, "target_min": defn.get("target_min"), "target_max": defn.get("target_max"),
            "target_text": defn.get("target_text"), "in_spec": in_spec, "recorded_by": actor,
            "recorded_at": now.isoformat(),
        })
    return resolved
