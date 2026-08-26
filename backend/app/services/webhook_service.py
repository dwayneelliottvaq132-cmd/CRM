from sqlalchemy.orm import Session

from app.models.webhook import WebhookEvent


def dispatch(db: Session, *, topic: str, payload: dict) -> WebhookEvent:
    """Records the outbound event. In this build delivery is simulated (marked delivered) —
    swap the body for an httpx POST to each subscriber URL once webhook subscriptions exist."""
    event = WebhookEvent(topic=topic, payload=payload, delivered=True)
    db.add(event)
    db.flush()
    return event
