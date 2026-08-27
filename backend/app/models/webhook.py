import datetime as dt

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base

WEBHOOK_TOPICS = ("job.status_changed", "ncr.opened", "invoice.paid")


class WebhookEvent(Base):
    """Outbound webhook event log. Delivery is simulated (logged) in this build —
    wire `services.webhooks.dispatch` to real subscriber URLs when they're known."""

    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic: Mapped[str] = mapped_column(String(60))
    payload: Mapped[dict] = mapped_column(JSONB)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
