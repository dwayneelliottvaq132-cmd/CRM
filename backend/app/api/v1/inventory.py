from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.inventory import InventoryLot
from app.models.user import User
from app.schemas.inventory import InventoryLotCreate, InventoryLotOut, InventoryLotUpdate
from app.services import audit_service

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[InventoryLotOut])
def list_inventory(db: Session = Depends(get_db)) -> list[InventoryLot]:
    return db.execute(select(InventoryLot).options(selectinload(InventoryLot.vendor)).order_by(InventoryLot.chemical_name)).scalars().all()


@router.post("", response_model=InventoryLotOut, status_code=201)
def create_lot(body: InventoryLotCreate, db: Session = Depends(get_db)) -> InventoryLot:
    lot = InventoryLot(**body.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.patch("/{lot_id}", response_model=InventoryLotOut)
def update_lot(lot_id: int, body: InventoryLotUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> InventoryLot:
    lot = db.get(InventoryLot, lot_id)
    if lot is None:
        raise HTTPException(404, "Lot not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(lot, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="inventory_lot", entity_id=str(lot_id), after=changes)
    db.commit()
    db.refresh(lot)
    return lot


@router.delete("/{lot_id}", status_code=204)
def delete_lot(lot_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    lot = db.get(InventoryLot, lot_id)
    if lot is None:
        raise HTTPException(404, "Lot not found")
    audit_service.record(db, actor=user.name, action="delete", entity_type="inventory_lot", entity_id=str(lot_id), before={"chemical_name": lot.chemical_name, "lot_number": lot.lot_number})
    db.delete(lot)
    db.commit()
