from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.integration import EmailIntakeLog
from app.schemas.email_intake import EmailIntakeLogOut, EmailIntakeStatus
from app.services import email_intake_service

router = APIRouter(prefix="/email-intake", tags=["email-intake"], dependencies=[Depends(get_current_user)])


@router.get("/status", response_model=EmailIntakeStatus)
def status(db: Session = Depends(get_db)) -> dict:
    return email_intake_service.status(db)


@router.get("/log", response_model=list[EmailIntakeLogOut])
def log(db: Session = Depends(get_db)) -> list[EmailIntakeLog]:
    return email_intake_service.recent_log(db)


@router.post("/poll-now", response_model=EmailIntakeStatus)
def poll_now(db: Session = Depends(get_db)) -> dict:
    """Triggers an immediate poll instead of waiting for the scheduled interval —
    useful right after configuring IMAP credentials, or to confirm the intake still works."""
    if not email_intake_service.settings.email_intake_configured:
        raise HTTPException(503, "Email intake is not configured — set IMAP_HOST/IMAP_USERNAME/IMAP_PASSWORD.")
    email_intake_service.poll_inbox(db)
    return email_intake_service.status(db)
