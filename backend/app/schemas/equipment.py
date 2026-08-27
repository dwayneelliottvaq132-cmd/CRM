import datetime as dt

from app.schemas.common import ORMModel


class EquipmentOut(ORMModel):
    id: str
    name: str
    location: str
    interval_text: str
    interval_months: int
    last_calibrated_at: dt.date | None
    due_at: dt.date | None
    active: bool = True


class CalibrationRecordOut(ORMModel):
    id: int
    performed_at: dt.datetime
    performed_by: str
    result: str
    next_due_at: dt.date | None


class CalibrationRecordCreate(ORMModel):
    result: str = "Pass"
    next_due_at: dt.date | None = None


class EquipmentCreate(ORMModel):
    name: str
    location: str
    interval_months: int = 12


class EquipmentUpdate(ORMModel):
    name: str | None = None
    location: str | None = None
    interval_months: int | None = None
