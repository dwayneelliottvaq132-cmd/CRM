import datetime as dt

from app.schemas.common import ORMModel


class NCROut(ORMModel):
    id: str
    job_id: str | None
    tank_id: str | None
    reference_label: str
    opened_at: dt.date
    disposition: str
    description: str


class NCRCreate(ORMModel):
    id: str
    reference_label: str
    disposition: str = "Open — MRB"
    description: str
    job_id: str | None = None
    tank_id: str | None = None


class CAPAOut(ORMModel):
    id: str
    ncr_id: str | None
    description: str
    due_date: dt.date | None
    closed_date: dt.date | None
    phase: str


class CAPACreate(ORMModel):
    id: str
    description: str
    due_date: dt.date | None = None
    phase: str = "Implement"
    ncr_id: str | None = None


class CAPAUpdate(ORMModel):
    phase: str | None = None
    closed_date: dt.date | None = None


class AuditProgramOut(ORMModel):
    id: int
    name: str
    pct_complete: int
    note: str
    scheduled_for: dt.date | None
