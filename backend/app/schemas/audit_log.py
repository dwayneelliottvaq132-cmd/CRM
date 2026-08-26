import datetime as dt

from app.schemas.common import ORMModel


class AuditLogEntryOut(ORMModel):
    id: int
    actor: str
    action: str
    entity_type: str
    entity_id: str
    before: dict | None
    after: dict | None
    created_at: dt.datetime


class WebhookEventOut(ORMModel):
    id: int
    topic: str
    payload: dict
    delivered: bool
    created_at: dt.datetime
