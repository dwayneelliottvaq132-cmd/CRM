import datetime as dt

from sqlalchemy import Boolean, DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Attachment(Base):
    """A reference photo or video attached to a Part (what the part looks like) or a
    RoutingStep (process instruction / quality alert for that step), shown to planners
    authoring the plan and to operators executing it on the shop floor. Polymorphic on
    (entity_type, entity_id) — same pattern as AuditLogEntry — rather than a dedicated
    FK per entity type, since the set of attachable entities may grow."""

    __tablename__ = "attachments"
    __table_args__ = (Index("ix_attachments_entity", "entity_type", "entity_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(30))  # "part" | "routing_step"
    entity_id: Mapped[str] = mapped_column(String(60))
    kind: Mapped[str] = mapped_column(String(10))  # "image" | "video"
    label: Mapped[str] = mapped_column(String(200), default="")
    # a quality alert (e.g. "watch for pitting here") is styled distinctly from a plain
    # reference photo on the shop floor so operators can't miss it
    is_quality_alert: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    stored_file_path: Mapped[str] = mapped_column(String(500))
    uploaded_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
