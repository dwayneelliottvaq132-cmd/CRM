import datetime as dt

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class NCR(Base):
    """Nonconformance report."""

    __tablename__ = "ncrs"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # NCR-26-031
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    tank_id: Mapped[str | None] = mapped_column(ForeignKey("tanks.id"), nullable=True)
    reference_label: Mapped[str] = mapped_column(String(40))  # what shows in the "job/tank" column
    opened_at: Mapped[dt.date] = mapped_column(Date, default=dt.date.today)
    disposition: Mapped[str] = mapped_column(String(40))  # Open — MRB | Rework | Process NCR | Closed
    description: Mapped[str] = mapped_column(String(500))
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    job = relationship("Job", back_populates="ncrs")
    capas: Mapped[list["CAPA"]] = relationship("CAPA", back_populates="ncr")


class CAPA(Base):
    """Corrective / preventive action tied to an NCR."""

    __tablename__ = "capas"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # CAPA-26-07
    ncr_id: Mapped[str | None] = mapped_column(ForeignKey("ncrs.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(500))
    due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    closed_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    phase: Mapped[str] = mapped_column(String(30))  # Verify | Implement | Closed
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    ncr = relationship("NCR", back_populates="capas")


class AuditProgram(Base):
    """Audit-readiness tracker shown on the Compliance dashboard."""

    __tablename__ = "audit_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    pct_complete: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(String(255))
    scheduled_for: Mapped[dt.date | None] = mapped_column(Date, nullable=True)


class CompanyMetric(Base):
    """Rolling quality KPI shown in the dashboard's Compliance Pulse widget
    (on-time delivery, first-pass yield, escapes, next audit dates...)."""

    __tablename__ = "company_metrics"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    label: Mapped[str] = mapped_column(String(160))
    value: Mapped[str] = mapped_column(String(40))
    kind: Mapped[str] = mapped_column(String(20), default="neutral")  # good | warn | bad | neutral
    updated_at: Mapped[dt.date] = mapped_column(Date, default=dt.date.today)
