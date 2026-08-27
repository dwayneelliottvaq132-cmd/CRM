import datetime as dt

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Equipment(Base):
    """Calibration-controlled instrument or process asset (ISO 10012)."""

    __tablename__ = "equipment"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # CAL-014
    name: Mapped[str] = mapped_column(String(160))
    location: Mapped[str] = mapped_column(String(120))
    interval_text: Mapped[str] = mapped_column(String(20))  # "12 mo", "6 mo", "3 mo"
    interval_months: Mapped[int] = mapped_column(default=12)
    last_calibrated_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    due_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    calibrations: Mapped[list["CalibrationRecord"]] = relationship(
        "CalibrationRecord", back_populates="equipment", order_by="CalibrationRecord.performed_at.desc()", cascade="all, delete-orphan"
    )

    def is_overdue(self, as_of: dt.date | None = None) -> bool:
        as_of = as_of or dt.date.today()
        return bool(self.due_at and self.due_at < as_of)


class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[str] = mapped_column(ForeignKey("equipment.id"))
    performed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    performed_by: Mapped[str] = mapped_column(String(120))
    result: Mapped[str] = mapped_column(String(40), default="Pass")
    next_due_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    equipment = relationship("Equipment", back_populates="calibrations")
