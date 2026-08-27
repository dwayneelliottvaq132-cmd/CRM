import datetime as dt

from sqlalchemy.orm import Session

from app.models.chemistry import Tank, TankAddition, TankAnalysis
from app.services import audit_service
from app.services.exceptions import NotFoundError


def log_analysis(db: Session, *, tank_id: str, result: float, actor: str, notes: str = "") -> Tank:
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise NotFoundError(f"Tank {tank_id} not found")

    before = {"held": tank.held, "last_result": float(tank.last_result) if tank.last_result is not None else None}

    in_limit = tank.in_control(result)
    analysis = TankAnalysis(tank_id=tank.id, result=result, in_limit=in_limit, analyzed_by=actor, notes=notes)
    db.add(analysis)

    tank.last_result = result
    tank.last_analyzed_at = dt.datetime.utcnow()
    tank.next_due_at = tank.last_analyzed_at + dt.timedelta(days=tank.analysis_interval_days)

    if in_limit:
        tank.held = False
        tank.hold_reason = None
    else:
        tank.held = True
        tank.hold_reason = f"Out of control: {result} vs limits {tank.limits_text}"

    db.flush()
    audit_service.record(
        db,
        actor=actor,
        action="log_analysis",
        entity_type="tank",
        entity_id=tank.id,
        before=before,
        after={"held": tank.held, "last_result": float(tank.last_result), "in_limit": in_limit},
    )
    return tank


def record_addition(db: Session, *, tank_id: str, chemical: str, amount: str, actor: str, notes: str = "") -> TankAddition:
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise NotFoundError(f"Tank {tank_id} not found")

    addition = TankAddition(tank_id=tank.id, chemical=chemical, amount=amount, added_by=actor, notes=notes)
    db.add(addition)
    db.flush()
    audit_service.record(
        db,
        actor=actor,
        action="record_addition",
        entity_type="tank",
        entity_id=tank.id,
        after={"chemical": chemical, "amount": amount},
    )
    return addition
