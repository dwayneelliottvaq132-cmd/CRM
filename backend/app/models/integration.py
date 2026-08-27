import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class QuickBooksConnection(Base):
    """Single-row table holding the current QuickBooks Online OAuth2 grant.
    Populated by the /quickbooks/callback flow once real credentials are configured."""

    __tablename__ = "quickbooks_connection"

    id: Mapped[int] = mapped_column(primary_key=True)
    realm_id: Mapped[str] = mapped_column(String(60))
    access_token: Mapped[str] = mapped_column(String(2000))
    refresh_token: Mapped[str] = mapped_column(String(2000))
    access_token_expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    refresh_token_expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    connected_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    last_synced_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailIntakeState(Base):
    """Single-row table (id=1) tracking the IMAP poller's heartbeat — updated on every poll
    attempt, whether or not any new mail was found, so the status page can distinguish
    'running, nothing new' from 'hasn't run since a crash/misconfiguration'."""

    __tablename__ = "email_intake_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    last_poll_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailIntakeLog(Base):
    """One row per inbound email considered by the poller (not per poll cycle) — the audit
    trail for what was auto-scanned, skipped, or failed, and the dedup check that stops an
    already-seen message (by its Message-ID header) from being reprocessed on the next poll."""

    __tablename__ = "email_intake_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[str] = mapped_column(String(998), index=True)
    sender: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str] = mapped_column(String(500))
    attachment_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20))  # Scanned | Skipped-Sender | Skipped-NoPdf | Error
    drawing_analysis_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("drawing_analyses.id"), nullable=True
    )
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
