import datetime as dt

from app.schemas.common import ORMModel


class TankOut(ORMModel):
    id: str
    solution: str
    parameter: str
    limits_text: str
    limit_min: float | None
    limit_max: float | None
    analysis_interval_days: int
    last_result: float | None
    last_analyzed_at: dt.datetime | None
    next_due_at: dt.datetime | None
    held: bool
    hold_reason: str | None


class TankAnalysisOut(ORMModel):
    id: int
    result: float
    in_limit: bool
    analyzed_by: str
    analyzed_at: dt.datetime
    notes: str


class TankAnalysisCreate(ORMModel):
    result: float
    notes: str = ""


class TankAdditionOut(ORMModel):
    id: int
    chemical: str
    amount: str
    added_by: str
    added_at: dt.datetime
    notes: str


class TankAdditionCreate(ORMModel):
    chemical: str
    amount: str
    notes: str = ""
