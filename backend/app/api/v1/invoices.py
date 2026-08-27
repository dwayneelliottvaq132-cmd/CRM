from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.invoice import InvoiceOut
from app.services import quickbooks_service
from app.services.exceptions import NotFoundError

router = APIRouter(prefix="/invoices", tags=["invoicing"], dependencies=[Depends(get_current_user)])


def _query():
    return select(Invoice).options(selectinload(Invoice.customer), selectinload(Invoice.lines))


@router.get("", response_model=list[InvoiceOut])
def list_invoices(db: Session = Depends(get_db)) -> list[Invoice]:
    return db.execute(_query().order_by(Invoice.id.desc())).scalars().all()


@router.post("/{invoice_id}/sync", response_model=InvoiceOut)
def sync_invoice(invoice_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Invoice:
    try:
        quickbooks_service.sync_invoice(db, invoice_id=invoice_id, actor=user.name)
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    return db.execute(_query().where(Invoice.id == invoice_id)).scalar_one()


@router.post("/sync-all", response_model=list[InvoiceOut])
def sync_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Invoice]:
    quickbooks_service.sync_all_pending(db, actor=user.name)
    db.commit()
    return db.execute(_query().order_by(Invoice.id.desc())).scalars().all()
