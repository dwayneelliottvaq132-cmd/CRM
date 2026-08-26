from sqlalchemy.orm import Session

from app.models.audit_log import AuditLogEntry


def record(
    db: Session,
    *,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    before: dict | None = None,
    after: dict | None = None,
) -> AuditLogEntry:
    entry = AuditLogEntry(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before=before,
        after=after,
    )
    db.add(entry)
    db.flush()
    return entry
