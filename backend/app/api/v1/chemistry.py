from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.chemistry import Tank
from app.models.user import User
from app.schemas.chemistry import (
    TankAdditionCreate,
    TankAdditionOut,
    TankAnalysisCreate,
    TankAnalysisOut,
    TankOut,
)
from app.services import chemistry_service
from app.services.exceptions import NotFoundError

router = APIRouter(prefix="/tanks", tags=["chemistry"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[TankOut])
def list_tanks(db: Session = Depends(get_db)) -> list[Tank]:
    return db.execute(select(Tank).order_by(Tank.id)).scalars().all()


@router.get("/{tank_id}", response_model=TankOut)
def get_tank(tank_id: str, db: Session = Depends(get_db)) -> Tank:
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise HTTPException(404, "Tank not found")
    return tank


@router.get("/{tank_id}/analyses", response_model=list[TankAnalysisOut])
def list_analyses(tank_id: str, db: Session = Depends(get_db)) -> list:
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise HTTPException(404, "Tank not found")
    return tank.analyses


@router.post("/{tank_id}/analyses", response_model=TankOut, status_code=201)
def log_analysis(tank_id: str, body: TankAnalysisCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Tank:
    try:
        tank = chemistry_service.log_analysis(db, tank_id=tank_id, result=body.result, actor=user.name, notes=body.notes)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    db.refresh(tank)
    return tank


@router.get("/{tank_id}/additions", response_model=list[TankAdditionOut])
def list_additions(tank_id: str, db: Session = Depends(get_db)) -> list:
    tank = db.get(Tank, tank_id)
    if tank is None:
        raise HTTPException(404, "Tank not found")
    return tank.additions


@router.post("/{tank_id}/additions", response_model=TankAdditionOut, status_code=201)
def record_addition(tank_id: str, body: TankAdditionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        addition = chemistry_service.record_addition(db, tank_id=tank_id, chemical=body.chemical, amount=body.amount, actor=user.name, notes=body.notes)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    db.refresh(addition)
    return addition
