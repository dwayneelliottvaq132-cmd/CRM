import datetime as dt

from app.schemas.common import ORMModel
from app.schemas.customer import CustomerOut


class InvoiceLineOut(ORMModel):
    job_id: str | None
    description: str
    amount: float


class InvoiceOut(ORMModel):
    id: str
    customer: CustomerOut
    amount: float
    terms: str
    status: str
    qb_sync_status: str
    quickbooks_invoice_id: str | None
    last_synced_at: dt.datetime | None
    lines: list[InvoiceLineOut]


class QuickBooksStatus(ORMModel):
    connected: bool
    mode: str
    last_sync: str | None
    detail: str
