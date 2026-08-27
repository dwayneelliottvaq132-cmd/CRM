import datetime as dt
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations import quickbooks as qb
from app.models.integration import QuickBooksConnection
from app.models.invoice import Invoice
from app.services import audit_service
from app.services.exceptions import NotFoundError

settings = get_settings()


def get_connection(db: Session) -> QuickBooksConnection | None:
    return db.execute(select(QuickBooksConnection)).scalars().first()


def connection_status(db: Session) -> dict:
    conn = get_connection(db)
    if not settings.qbo_configured:
        return {"connected": False, "mode": "simulated", "last_sync": None, "detail": "No QBO_CLIENT_ID/SECRET configured — sync calls are simulated."}
    if conn is None:
        return {"connected": False, "mode": "live", "last_sync": None, "detail": "Not connected — visit /api/v1/quickbooks/authorize."}
    return {"connected": True, "mode": "live", "last_sync": conn.last_synced_at.isoformat() if conn.last_synced_at else None, "detail": f"Connected to realm {conn.realm_id}"}


def authorization_url() -> str:
    return qb.get_authorization_url()


def handle_callback(db: Session, *, auth_code: str, realm_id: str) -> QuickBooksConnection:
    tokens = qb.exchange_code_for_tokens(auth_code, realm_id)
    conn = get_connection(db) or QuickBooksConnection(realm_id=realm_id, access_token="", refresh_token="", access_token_expires_at=dt.datetime.utcnow(), refresh_token_expires_at=dt.datetime.utcnow())
    conn.realm_id = tokens.realm_id
    conn.access_token = tokens.access_token
    conn.refresh_token = tokens.refresh_token
    conn.access_token_expires_at = tokens.access_token_expires_at
    conn.refresh_token_expires_at = tokens.refresh_token_expires_at
    db.add(conn)
    db.flush()
    return conn


def sync_invoice(db: Session, *, invoice_id: str, actor: str) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise NotFoundError(f"Invoice {invoice_id} not found")

    invoice.qb_sync_status = "Syncing"
    db.flush()

    conn = get_connection(db)
    if settings.qbo_configured and conn is not None:
        try:
            qbo_id = qb.push_invoice(
                conn,
                customer_name=invoice.customer.name,
                invoice_number=invoice.id,
                amount=float(invoice.amount),
                memo=", ".join(line.job_id or line.description or "line" for line in invoice.lines),
            )
            invoice.quickbooks_invoice_id = qbo_id
            invoice.qb_sync_status = "Synced"
            conn.last_synced_at = dt.datetime.utcnow()
        except Exception as exc:  # noqa: BLE001 — surfaced to caller as sync failure
            invoice.qb_sync_status = "Error"
            db.flush()
            audit_service.record(db, actor=actor, action="qb_sync_error", entity_type="invoice", entity_id=invoice.id, after={"error": str(exc)})
            raise
    else:
        # No live QBO app configured — simulate the round trip the mockup shows.
        time.sleep(0.6)
        invoice.quickbooks_invoice_id = invoice.quickbooks_invoice_id or f"SIM-{invoice.id}"
        invoice.qb_sync_status = "Synced"

    db.flush()
    audit_service.record(db, actor=actor, action="qb_sync", entity_type="invoice", entity_id=invoice.id, after={"qb_sync_status": invoice.qb_sync_status})
    return invoice


def sync_all_pending(db: Session, *, actor: str) -> list[Invoice]:
    pending = db.execute(select(Invoice).where(Invoice.qb_sync_status.in_(["Not synced", "Pending", "Error"]))).scalars().all()
    return [sync_invoice(db, invoice_id=inv.id, actor=actor) for inv in pending]
