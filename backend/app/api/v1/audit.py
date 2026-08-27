from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.audit_log import AuditLogEntry
from app.models.webhook import WebhookEvent
from app.schemas.audit_log import AuditLogEntryOut, WebhookEventOut

router = APIRouter(tags=["audit"], dependencies=[Depends(get_current_user)])


@router.get("/audit-log", response_model=list[AuditLogEntryOut])
def audit_log(entity_type: str | None = None, entity_id: str | None = None, limit: int = 100, db: Session = Depends(get_db)) -> list[AuditLogEntry]:
    stmt = select(AuditLogEntry).order_by(AuditLogEntry.created_at.desc()).limit(limit)
    if entity_type:
        stmt = stmt.where(AuditLogEntry.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLogEntry.entity_id == entity_id)
    return db.execute(stmt).scalars().all()


@router.get("/webhooks/events", response_model=list[WebhookEventOut])
def webhook_events(limit: int = 50, db: Session = Depends(get_db)) -> list[WebhookEvent]:
    return db.execute(select(WebhookEvent).order_by(WebhookEvent.created_at.desc()).limit(limit)).scalars().all()
