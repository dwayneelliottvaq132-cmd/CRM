import datetime as dt
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class FinishRate(Base):
    """Per-process pricing rate: $/in² of surface area, with a lot-charge floor.

    Most work here is priced by surface area, so this is the table the quoting
    path reads. `lot_minimum` is a floor on the whole line, not a per-part
    charge — a small part in small quantity bills the minimum rather than
    area x rate. Both are Numeric, not float, because they are money.
    """

    __tablename__ = "finish_rates"
    __table_args__ = (UniqueConstraint("process", "spec", name="uq_finish_rates_process_spec"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    process: Mapped[str] = mapped_column(String(120))          # "Type II Anodize"
    spec: Mapped[str] = mapped_column(String(160), default="")  # "MIL-A-8625 Ty II Cl 2"
    rate_per_sq_in: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=0)
    lot_minimum: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    notes: Mapped[str] = mapped_column(String(400), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    updated_by: Mapped[str] = mapped_column(String(120), default="")
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
