import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class FinishRateOut(ORMModel):
    id: int
    process: str
    spec: str
    rate_per_sq_in: Decimal
    lot_minimum: Decimal
    notes: str
    active: bool
    updated_by: str
    updated_at: dt.datetime | None = None


class FinishRateCreate(BaseModel):
    process: str = Field(min_length=1, max_length=120)
    spec: str = Field(default="", max_length=160)
    rate_per_sq_in: Decimal = Field(default=Decimal("0"), ge=0)
    lot_minimum: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str = Field(default="", max_length=400)


class FinishRateUpdate(BaseModel):
    process: str | None = Field(default=None, min_length=1, max_length=120)
    spec: str | None = Field(default=None, max_length=160)
    rate_per_sq_in: Decimal | None = Field(default=None, ge=0)
    lot_minimum: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=400)
    active: bool | None = None
