"""Email intake — polls an IMAP inbox for unread mail from allowlisted senders and feeds
any PDF attachments through the same drawing_analysis_service.analyze_pdf() used by manual
uploads on the Drawings page. Runs on an in-process APScheduler job (see app.main) so it
works identically under the EC2 systemd deploy and a local dev run — no separate service to
stand up. Disabled entirely (job never scheduled) unless IMAP credentials are configured."""

import datetime as dt
import email
import email.utils
import imaplib
from email.message import Message

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.integration import EmailIntakeLog, EmailIntakeState
from app.services import drawing_analysis_service
from app.services.exceptions import BusinessRuleError

settings = get_settings()


def status(db: Session) -> dict:
    state = _get_state(db)
    configured = settings.email_intake_configured
    if not configured:
        detail = "No IMAP_HOST/IMAP_USERNAME/IMAP_PASSWORD configured — email intake is disabled."
    elif not settings.imap_allowed_sender_list:
        detail = "Configured, but IMAP_ALLOWED_SENDERS is empty — no sender is allowlisted, so nothing will be scanned."
    elif state.last_poll_at is None:
        detail = "Configured — waiting for the first poll."
    else:
        detail = "Running."
    return {
        "configured": configured,
        "imap_host": settings.imap_host,
        "imap_folder": settings.imap_folder,
        "allowed_senders": settings.imap_allowed_sender_list,
        "poll_interval_minutes": settings.imap_poll_interval_minutes,
        "last_poll_at": state.last_poll_at,
        "last_error": state.last_error,
        "last_error_at": state.last_error_at,
        "detail": detail,
    }


def recent_log(db: Session, limit: int = 50) -> list[EmailIntakeLog]:
    rows = db.execute(
        select(EmailIntakeLog).order_by(EmailIntakeLog.processed_at.desc()).limit(limit)
    ).scalars().all()
    return list(rows)


def _get_state(db: Session) -> EmailIntakeState:
    state = db.get(EmailIntakeState, 1)
    if state is None:
        state = EmailIntakeState(id=1)
        db.add(state)
        db.flush()
    return state


def _sender_allowed(sender_email: str) -> bool:
    sender_email = sender_email.lower()
    for entry in settings.imap_allowed_sender_list:
        if entry.startswith("@"):
            if sender_email.endswith(entry):
                return True
        elif sender_email == entry:
            return True
    return False


def _pdf_attachments(msg: Message) -> list[tuple[str, bytes]]:
    attachments = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        filename = part.get_filename() or ""
        content_type = part.get_content_type()
        is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")
        if not is_pdf:
            continue
        payload = part.get_payload(decode=True)
        if payload:
            attachments.append((filename or "attachment.pdf", payload))
    return attachments


def _process_message(db: Session, msg: Message, *, message_id: str) -> list[EmailIntakeLog]:
    """Pure-ish message handler, independent of the IMAP connection, so it can be unit
    tested with a synthetic email.message.Message. Returns the log rows it created;
    never raises — every outcome (skip/scan/error) is captured as a log row instead."""
    sender = email.utils.parseaddr(msg.get("From", ""))[1] or msg.get("From", "")
    subject = msg.get("Subject", "")[:500]

    if not _sender_allowed(sender):
        row = EmailIntakeLog(
            message_id=message_id, sender=sender[:320], subject=subject,
            status="Skipped-Sender", processed_at=dt.datetime.utcnow(),
        )
        db.add(row)
        db.flush()
        return [row]

    attachments = _pdf_attachments(msg)
    if not attachments:
        row = EmailIntakeLog(
            message_id=message_id, sender=sender[:320], subject=subject,
            status="Skipped-NoPdf", processed_at=dt.datetime.utcnow(),
        )
        db.add(row)
        db.flush()
        return [row]

    rows = []
    for filename, data in attachments:
        try:
            analysis = drawing_analysis_service.analyze_pdf(
                db, filename=filename, data=data, actor=f"email-intake:{sender}"
            )
            row = EmailIntakeLog(
                message_id=message_id, sender=sender[:320], subject=subject,
                attachment_filename=filename[:255], status="Scanned",
                drawing_analysis_id=analysis.id, processed_at=dt.datetime.utcnow(),
            )
        except BusinessRuleError as exc:
            row = EmailIntakeLog(
                message_id=message_id, sender=sender[:320], subject=subject,
                attachment_filename=filename[:255], status="Error",
                error_detail=str(exc)[:2000], processed_at=dt.datetime.utcnow(),
            )
        db.add(row)
        db.flush()
        rows.append(row)
    return rows


def poll_inbox(db: Session) -> None:
    """Connects to the configured IMAP inbox, processes every unread message not already
    logged, and marks each as read once handled (success or failure) so it's never retried
    forever. Commits incrementally per message so one bad message can't roll back the rest."""
    if not settings.email_intake_configured:
        return

    state = _get_state(db)
    state.last_poll_at = dt.datetime.utcnow()
    db.commit()

    try:
        conn = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port)
        try:
            conn.login(settings.imap_username, settings.imap_password)
            conn.select(settings.imap_folder)
            status_, data = conn.search(None, "UNSEEN")
            if status_ != "OK":
                raise RuntimeError(f"IMAP SEARCH failed: {status_}")
            uids = data[0].split()
            for uid in uids:
                status_, msg_data = conn.fetch(uid, "(RFC822)")
                if status_ != "OK" or not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)
                message_id = msg.get("Message-ID") or f"<no-message-id:{uid.decode()}@{settings.imap_folder}>"

                already = db.execute(
                    select(EmailIntakeLog.id).where(EmailIntakeLog.message_id == message_id).limit(1)
                ).first()
                if not already:
                    _process_message(db, msg, message_id=message_id)
                    db.commit()
                conn.store(uid, "+FLAGS", "\\Seen")
        finally:
            try:
                conn.logout()
            except Exception:  # noqa: BLE001 — best-effort cleanup
                pass
    except Exception as exc:  # noqa: BLE001 — one bad poll must not crash the scheduler
        db.rollback()
        state = _get_state(db)
        state.last_error = str(exc)[:2000]
        state.last_error_at = dt.datetime.utcnow()
        db.commit()
