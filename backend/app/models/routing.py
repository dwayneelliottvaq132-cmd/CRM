import datetime as dt

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class RoutingTemplate(Base):
    """A reusable, spec-based routing definition — not tied to any one part number.
    Its revisions (RoutingRevision, owner=this) can be cloned into a Part's own plan."""

    __tablename__ = "routing_templates"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # RT-001
    name: Mapped[str] = mapped_column(String(160))
    spec: Mapped[str] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    revisions: Mapped[list["RoutingRevision"]] = relationship(
        "RoutingRevision",
        primaryjoin="RoutingTemplate.id == RoutingRevision.routing_template_id",
        order_by="RoutingRevision.revision_number",
        cascade="all, delete-orphan",
    )


class Part(Base):
    """A customer's specific part number + engineering revision — gets its own
    independent, revision-controlled process plan (may be cloned from a RoutingTemplate
    as a starting point, then edited independently from then on)."""

    __tablename__ = "parts"
    __table_args__ = (UniqueConstraint("customer_id", "part_number", "revision", name="uq_part_customer_number_revision"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    part_number: Mapped[str] = mapped_column(String(60))
    revision: Mapped[str] = mapped_column(String(10))
    spec: Mapped[str] = mapped_column(String(120))
    itar: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    customer = relationship("Customer")
    revisions: Mapped[list["RoutingRevision"]] = relationship(
        "RoutingRevision",
        primaryjoin="Part.id == RoutingRevision.part_id",
        order_by="RoutingRevision.revision_number",
        cascade="all, delete-orphan",
    )


class RoutingRevision(Base):
    """Shared revision history for BOTH RoutingTemplate and Part — exactly one of
    routing_template_id / part_id is set per row (enforced by CHECK constraint below).
    At most one Released revision may exist per owner at a time (partial unique indexes)."""

    __tablename__ = "routing_revisions"
    __table_args__ = (
        CheckConstraint(
            "(routing_template_id IS NOT NULL AND part_id IS NULL) OR (routing_template_id IS NULL AND part_id IS NOT NULL)",
            name="ck_routing_revision_owner_xor",
        ),
        UniqueConstraint("routing_template_id", "revision_number", name="uq_routing_rev_template_number"),
        UniqueConstraint("part_id", "revision_number", name="uq_routing_rev_part_number"),
        Index(
            "uq_routing_rev_template_released",
            "routing_template_id",
            unique=True,
            postgresql_where="status = 'Released'",
        ),
        Index(
            "uq_routing_rev_part_released",
            "part_id",
            unique=True,
            postgresql_where="status = 'Released'",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    routing_template_id: Mapped[str | None] = mapped_column(ForeignKey("routing_templates.id"), nullable=True)
    part_id: Mapped[int | None] = mapped_column(ForeignKey("parts.id"), nullable=True)
    revision_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="Draft")  # Draft | Released | Superseded | Obsolete
    cloned_from_revision_id: Mapped[int | None] = mapped_column(ForeignKey("routing_revisions.id"), nullable=True)
    source_drawing_analysis_id: Mapped[int | None] = mapped_column(ForeignKey("drawing_analyses.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    released_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    released_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    superseded_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    steps: Mapped[list["RoutingStep"]] = relationship(
        "RoutingStep", back_populates="revision", order_by="RoutingStep.seq", cascade="all, delete-orphan"
    )


class RoutingStep(Base):
    """One step within a RoutingRevision — mirrors JobOperation's shape so it can be
    cloned 1:1 into a job's operations at job-creation time."""

    __tablename__ = "routing_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    routing_revision_id: Mapped[int] = mapped_column(ForeignKey("routing_revisions.id"))
    seq: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(120))
    parameters: Mapped[str] = mapped_column(String(255), default="")
    work_instruction_doc_no: Mapped[str | None] = mapped_column(ForeignKey("documents.doc_no"), nullable=True)
    tank_id: Mapped[str | None] = mapped_column(ForeignKey("tanks.id"), nullable=True)
    equipment_id: Mapped[str | None] = mapped_column(ForeignKey("equipment.id"), nullable=True)
    is_final_inspect: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # required process variables to be recorded when this step is signed off:
    # [{key, label, kind, unit, target_min, target_max, target_text, auto_computed, required}]
    required_parameters: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    revision: Mapped["RoutingRevision"] = relationship("RoutingRevision", back_populates="steps")
