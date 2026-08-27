import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.equipment import CalibrationRecord, Equipment
from app.models.user import User
from app.schemas.equipment import CalibrationRecordCreate, CalibrationRecordOut, EquipmentCreate, EquipmentOut, EquipmentUpdate
from app.services import audit_service, id_service

router = APIRouter(prefix="/equipment", tags=["calibration"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[EquipmentOut])
def list_equipment(include_inactive: bool = False, db: Session = Depends(get_db)) -> list[Equipment]:
    stmt = select(Equipment).order_by(Equipment.due_at.asc().nulls_last())
    if not include_inactive:
        stmt = stmt.where(Equipment.active.is_(True))
    return db.execute(stmt).scalars().all()


@router.post("", response_model=EquipmentOut, status_code=201)
def create_equipment(body: EquipmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Equipment:
    asset_id = id_service.next_id(db, Equipment, "CAL-", 3)
    eq = Equipment(
        id=asset_id,
        name=body.name,
        location=body.location,
        interval_text=f"{body.interval_months} mo",
        interval_months=body.interval_months,
    )
    db.add(eq)
    db.flush()
    audit_service.record(db, actor=user.name, action="create", entity_type="equipment", entity_id=asset_id, after=body.model_dump(mode="json"))
    db.commit()
    db.refresh(eq)
    return eq


@router.patch("/{asset_id}", response_model=EquipmentOut)
def update_equipment(asset_id: str, body: EquipmentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Equipment:
    eq = db.get(Equipment, asset_id)
    if eq is None:
        raise HTTPException(404, "Equipment not found")
    changes = body.model_dump(exclude_unset=True)
    if "interval_months" in changes and changes["interval_months"] is not None:
        eq.interval_text = f"{changes['interval_months']} mo"
    for field, value in changes.items():
        setattr(eq, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="equipment", entity_id=asset_id, after=changes)
    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{asset_id}", status_code=204)
def archive_equipment(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Soft delete — calibration history and any traveler operations that referenced
    this asset stay intact; it's just hidden from selection going forward."""
    eq = db.get(Equipment, asset_id)
    if eq is None:
        raise HTTPException(404, "Equipment not found")
    eq.active = False
    db.flush()
    audit_service.record(db, actor=user.name, action="archive", entity_type="equipment", entity_id=asset_id, after={"active": False})
    db.commit()


@router.get("/{asset_id}/calibrations", response_model=list[CalibrationRecordOut])
def list_calibrations(asset_id: str, db: Session = Depends(get_db)) -> list[CalibrationRecord]:
    eq = db.get(Equipment, asset_id)
    if eq is None:
        raise HTTPException(404, "Equipment not found")
    return eq.calibrations


@router.post("/{asset_id}/calibrations", response_model=EquipmentOut, status_code=201)
def record_calibration(asset_id: str, body: CalibrationRecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Equipment:
    eq = db.get(Equipment, asset_id)
    if eq is None:
        raise HTTPException(404, "Equipment not found")

    now = dt.datetime.utcnow()
    next_due = body.next_due_at or (now.date() + dt.timedelta(days=30 * eq.interval_months))
    db.add(CalibrationRecord(equipment_id=asset_id, performed_at=now, performed_by=user.name, result=body.result, next_due_at=next_due))
    eq.last_calibrated_at = now.date()
    eq.due_at = next_due
    db.flush()
    audit_service.record(db, actor=user.name, action="calibrate", entity_type="equipment", entity_id=asset_id, after={"result": body.result, "next_due_at": next_due.isoformat()})
    db.commit()
    db.refresh(eq)
    return eq
