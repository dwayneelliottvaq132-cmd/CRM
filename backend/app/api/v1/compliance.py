from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.compliance import CAPA, NCR, AuditProgram
from app.models.user import User
from app.schemas.compliance import (
    AuditProgramOut,
    CAPACreate,
    CAPAOut,
    CAPAUpdate,
    NCRCreate,
    NCROut,
)
from app.services import ncr_service

router = APIRouter(tags=["compliance"], dependencies=[Depends(get_current_user)])


@router.get("/ncrs", response_model=list[NCROut])
def list_ncrs(db: Session = Depends(get_db)) -> list[NCR]:
    return db.execute(select(NCR).order_by(NCR.opened_at.desc())).scalars().all()


@router.post("/ncrs", response_model=NCROut, status_code=201)
def create_ncr(body: NCRCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> NCR:
    if db.get(NCR, body.id):
        raise HTTPException(409, f"NCR {body.id} already exists")
    ncr = ncr_service.create(db, ncr_id=body.id, reference_label=body.reference_label, disposition=body.disposition, description=body.description, actor=user.name, job_id=body.job_id, tank_id=body.tank_id)
    db.commit()
    db.refresh(ncr)
    return ncr


@router.get("/capas", response_model=list[CAPAOut])
def list_capas(db: Session = Depends(get_db)) -> list[CAPA]:
    return db.execute(select(CAPA).order_by(CAPA.due_date.asc().nulls_last())).scalars().all()


@router.post("/capas", response_model=CAPAOut, status_code=201)
def create_capa(body: CAPACreate, db: Session = Depends(get_db)) -> CAPA:
    if db.get(CAPA, body.id):
        raise HTTPException(409, f"CAPA {body.id} already exists")
    capa = CAPA(**body.model_dump())
    db.add(capa)
    db.commit()
    db.refresh(capa)
    return capa


@router.patch("/capas/{capa_id}", response_model=CAPAOut)
def update_capa(capa_id: str, body: CAPAUpdate, db: Session = Depends(get_db)) -> CAPA:
    capa = db.get(CAPA, capa_id)
    if capa is None:
        raise HTTPException(404, "CAPA not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(capa, field, value)
    db.commit()
    db.refresh(capa)
    return capa


@router.get("/audit-programs", response_model=list[AuditProgramOut])
def list_audit_programs(db: Session = Depends(get_db)) -> list[AuditProgram]:
    return db.execute(select(AuditProgram).order_by(AuditProgram.scheduled_for.asc().nulls_last())).scalars().all()
