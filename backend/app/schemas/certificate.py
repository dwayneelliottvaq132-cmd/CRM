import datetime as dt

from app.schemas.common import ORMModel


class CertificateOut(ORMModel):
    id: str
    job_id: str
    qty_accepted: int
    process_text: str
    issued: bool
    issued_at: dt.datetime | None
    issued_by: str | None
    blocked_reason: str | None
    material_lot: str | None = None
    part_number: str | None = None
    revision: str | None = None
    spec: str | None = None
    routing_revision_label: str | None = None
    recorded_readings: list | None = None


class CertQueueItem(ORMModel):
    job_id: str
    customer_name: str
    process_label: str
    ready: bool
    state: str  # "Ready to issue" | "Issued <date>" | "Blocked — <reason>" | "Awaiting final insp."
    certificate_id: str | None


class CertIssueRequest(ORMModel):
    cert_id: str
