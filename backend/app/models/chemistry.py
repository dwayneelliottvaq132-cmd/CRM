import datetime as dt

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Tank(Base):
    """A process tank / bath under Nadcap AC7108 solution control."""

    __tablename__ = "tanks"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # T-09
    solution: Mapped[str] = mapped_column(String(120))
    parameter: Mapped[str] = mapped_column(String(60))
    limits_text: Mapped[str] = mapped_column(String(60))  # display form, e.g. "5.5 – 6.0" or "≤ 15.0"
    limit_min: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    limit_max: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    analysis_interval_days: Mapped[int] = mapped_column(default=7)

    last_result: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    last_analyzed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_due_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    held: Mapped[bool] = mapped_column(Boolean, default=False)  # auto-hold: out-of-control
    hold_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    analyses: Mapped[list["TankAnalysis"]] = relationship(
        "TankAnalysis", back_populates="tank", order_by="TankAnalysis.analyzed_at.desc()", cascade="all, delete-orphan"
    )
    additions: Mapped[list["TankAddition"]] = relationship(
        "TankAddition", back_populates="tank", order_by="TankAddition.added_at.desc()", cascade="all, delete-orphan"
    )

    def in_control(self, value: float) -> bool:
        if self.limit_min is not None and value < float(self.limit_min):
            return False
        if self.limit_max is not None and value > float(self.limit_max):
            return False
        return True


class TankAnalysis(Base):
    __tablename__ = "tank_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    tank_id: Mapped[str] = mapped_column(ForeignKey("tanks.id"))
    result: Mapped[float] = mapped_column(Numeric(10, 3))
    in_limit: Mapped[bool] = mapped_column(Boolean)
    analyzed_by: Mapped[str] = mapped_column(String(120))
    analyzed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    notes: Mapped[str] = mapped_column(String(255), default="")

    tank = relationship("Tank", back_populates="analyses")


class TankAddition(Base):
    __tablename__ = "tank_additions"

    id: Mapped[int] = mapped_column(primary_key=True)
    tank_id: Mapped[str] = mapped_column(ForeignKey("tanks.id"))
    chemical: Mapped[str] = mapped_column(String(120))
    amount: Mapped[str] = mapped_column(String(60))
    added_by: Mapped[str] = mapped_column(String(120))
    added_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    notes: Mapped[str] = mapped_column(String(255), default="")

    tank = relationship("Tank", back_populates="additions")
