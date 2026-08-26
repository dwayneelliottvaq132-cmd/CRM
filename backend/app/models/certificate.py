import datetime as dt

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Certificate(Base):
    """Certificate of Conformance — generated only when a job is fully signed off
    and no operation touched a tank that was out-of-control at the time of processing."""

    __tablename__ = "certificates"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # CERT-26-0891
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"))
    qty_accepted: Mapped[int] = mapped_column(Integer)
    process_text: Mapped[str] = mapped_column(String(255))
    issued: Mapped[bool] = mapped_column(Boolean, default=False)
    issued_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issued_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    blocked_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    # Traceability snapshot frozen at issue time (AS9100 §8.5.2 / §7.5.3) — a released C of C
    # is an immutable record and must not drift if the job is later edited. Null on certs
    # issued before this snapshot existed; the PDF falls back to live job fields in that case.
    material_lot: Mapped[str | None] = mapped_column(String(40), nullable=True)
    part_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    revision: Mapped[str | None] = mapped_column(String(10), nullable=True)
    spec: Mapped[str | None] = mapped_column(String(120), nullable=True)
    routing_revision_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # [{op_seq, op_name, label, value, unit, in_spec, recorded_by, recorded_at}]
    recorded_readings: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    job = relationship("Job", back_populates="certificates")
