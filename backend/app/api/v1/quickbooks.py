from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.schemas.invoice import QuickBooksStatus
from app.services import quickbooks_service

router = APIRouter(prefix="/quickbooks", tags=["quickbooks"])
settings = get_settings()


@router.get("/status", response_model=QuickBooksStatus, dependencies=[Depends(get_current_user)])
def status(db: Session = Depends(get_db)) -> dict:
    return quickbooks_service.connection_status(db)


@router.get("/authorize")
def authorize():
    if not settings.qbo_configured:
        raise HTTPException(400, "Set QBO_CLIENT_ID / QBO_CLIENT_SECRET to enable live QuickBooks OAuth")
    return RedirectResponse(quickbooks_service.authorization_url())


@router.get("/callback")
def callback(code: str, realmId: str, db: Session = Depends(get_db)):
    if not settings.qbo_configured:
        raise HTTPException(400, "QuickBooks integration not configured")
    conn = quickbooks_service.handle_callback(db, auth_code=code, realm_id=realmId)
    db.commit()
    return {"connected": True, "realm_id": conn.realm_id}
