import datetime as dt

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

JOB_STATUSES = ("Queued", "In Process", "Final Inspect", "Hold — NCR", "Shipped", "Complete")


class Job(Base):
    """A job traveler — the paperless router that follows a lot through the process."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # J-26187
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    customer_po: Mapped[str] = mapped_column(String(60))
    part_number: Mapped[str] = mapped_column(String(60))
    revision: Mapped[str] = mapped_column(String(10))
    qty: Mapped[int] = mapped_column(Integer)
    material_lot: Mapped[str] = mapped_column(String(40))
    process_label: Mapped[str] = mapped_column(String(120))
    spec: Mapped[str] = mapped_column(String(120))
    spec_note: Mapped[str] = mapped_column(String(255), default="")
    due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    due_note: Mapped[str] = mapped_column(String(120), default="")
    itar: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="Queued")
    governing_doc_no: Mapped[str | None] = mapped_column(ForeignKey("documents.doc_no"), nullable=True)
    # which Part routing revision seeded this job's ops (as-built traceability); null if no
    # approved plan existed at creation time (see routing_warning for the fallback reason).
    source_routing_revision_id: Mapped[int | None] = mapped_column(ForeignKey("routing_revisions.id"), nullable=True)
    routing_warning: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # special requirements flowed down from the source purchase order (general_requirements +
    # that line's line_requirements), e.g. "Certificate of Conformance required" — null for
    # jobs not created from a scanned PO.
    po_requirements: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    # "Needs Planning" | "Planned" — a job is created with no operations and sits in
    # "Needs Planning" until a planner explicitly completes the Planning module step
    # (attach a released plan or proceed without one). Kept separate from `status` so
    # dashboard/WIP counts and existing status checks are unaffected either way.
    planning_status: Mapped[str] = mapped_column(String(20), default="Planned", server_default="Planned")
    # the drawing scan (if any) matched to this job's part at PO-scan time, carried
    # forward so the Planning module can offer "Populate from Drawing Scan".
    source_drawing_analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("drawing_analyses.id"), nullable=True
    )

    customer = relationship("Customer", back_populates="jobs")
    source_routing_revision = relationship("RoutingRevision")
    source_drawing_analysis = relationship("DrawingAnalysis")
    ops: Mapped[list["JobOperation"]] = relationship(
        "JobOperation", back_populates="job", order_by="JobOperation.seq", cascade="all, delete-orphan"
    )
    ncrs = relationship("NCR", back_populates="job")
    certificates = relationship("Certificate", back_populates="job")
    spec_results: Mapped[list["SpecResult"]] = relationship(
        "SpecResult", back_populates="job", order_by="SpecResult.recorded_at", cascade="all, delete-orphan"
    )

    def current_op(self) -> "JobOperation | None":
        for op in self.ops:
            if not op.done:
                return op
        return None

    def all_ops_done(self) -> bool:
        return bool(self.ops) and all(op.done for op in self.ops)

    def unresolved_failed_specs(self) -> list["SpecResult"]:
        """Failed spec results that still block shipment. A FAIL clears via a later
        passing re-test of the same parameter (param_key) or an explicit disposition."""
        latest_by_param: dict[str, SpecResult] = {}
        for r in self.spec_results:  # ordered by recorded_at
            latest_by_param[r.param_key] = r
        return [r for r in latest_by_param.values() if not r.passed and r.resolved_at is None]

    @property
    def ship_blockers(self) -> list[str]:
        blockers: list[str] = []
        if self.status == "Shipped":
            blockers.append("Job is already shipped")
        if self.status == "Hold — NCR":
            blockers.append("Job is on NCR hold — lift the hold via Compliance first")
        if self.planning_status == "Needs Planning":
            blockers.append("Planning has not been completed for this job — see the Planning module")
        if not self.all_ops_done():
            unsigned = sum(1 for o in self.ops if not o.done)
            blockers.append(f"{unsigned} operation(s) not signed off")
        for r in self.unresolved_failed_specs():
            req = f" (req {r.requirement})" if r.requirement else ""
            val = f" — recorded {r.value_text}" if r.value_text else ""
            blockers.append(f"FAILED SPEC: {r.name}{req}{val}")
        return blockers

    @property
    def routing_planned(self) -> bool:
        return self.source_routing_revision_id is not None

    @property
    def source_routing_revision_label(self) -> str | None:
        rev = self.source_routing_revision
        if rev is None:
            return None
        owner = "Part Plan" if rev.part_id else "Template"
        return f"{owner} Rev {rev.revision_number}"

    @property
    def ship_ready(self) -> bool:
        return not self.ship_blockers

    # Cheap batch-signoff matching keys — "same process" means another open job
    # whose current op shares tank_id (or equipment_id, if no tank) and name.
    # Backed by current_op(), which reads self.ops — already eager-loaded by the
    # list endpoint's query, so exposing these costs nothing extra.
    @property
    def current_op_seq(self) -> int | None:
        op = self.current_op()
        return op.seq if op else None

    @property
    def current_op_name(self) -> str | None:
        op = self.current_op()
        return op.name if op else None

    @property
    def current_op_tank_id(self) -> str | None:
        op = self.current_op()
        return op.tank_id if op else None

    @property
    def current_op_equipment_id(self) -> str | None:
        op = self.current_op()
        return op.equipment_id if op else None


class JobOperation(Base):
    """One line of the traveler / router."""

    __tablename__ = "job_operations"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"))
    seq: Mapped[int] = mapped_column(Integer)  # 10, 20, 30...
    name: Mapped[str] = mapped_column(String(120))
    parameters: Mapped[str] = mapped_column(String(255))
    work_instruction_doc_no: Mapped[str | None] = mapped_column(ForeignKey("documents.doc_no"), nullable=True)
    tank_id: Mapped[str | None] = mapped_column(ForeignKey("tanks.id"), nullable=True)
    equipment_id: Mapped[str | None] = mapped_column(ForeignKey("equipment.id"), nullable=True)
    # the RoutingStep this op was cloned from at plan-application time — lets the shop
    # floor look up that step's reference photos/videos (process instructions, quality
    # alerts) for the operator. Null for placeholder/default-step jobs with no source plan.
    source_routing_step_id: Mapped[int | None] = mapped_column(ForeignKey("routing_steps.id"), nullable=True)

    done: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    signed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # snapshot at time of sign-off: was the linked tank out of control? Required for cert-blocking rule.
    tank_ooc_at_signoff: Mapped[bool] = mapped_column(Boolean, default=False)
    is_final_inspect: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # required process variables for this op, cloned from the source RoutingStep at job
    # creation: [{key, label, kind, unit, target_min, target_max, target_text, auto_computed, required}]
    required_parameters: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # actual values recorded at sign-off: [{key, label, unit, kind, value, target_min, target_max,
    # target_text, in_spec, recorded_by, recorded_at}]
    recorded_parameters: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # true if any non-required (informational) recorded reading came back out of spec —
    # required readings that fail block sign-off outright, so they never reach this state.
    has_out_of_spec_reading: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    job = relationship("Job", back_populates="ops")
    tank = relationship("Tank")
    equipment = relationship("Equipment")


class SpecResult(Base):
    """A recorded in-process spec check (e.g. etch time, plating thickness) with pass/fail.

    Shipping is blocked while a job has any failed spec result that is neither
    superseded by a later passing re-test of the same parameter nor explicitly
    resolved (MRB-style disposition with a note).
    """

    __tablename__ = "spec_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"))
    # groups re-tests of the same parameter so a later PASS supersedes an earlier FAIL
    param_key: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(160))  # e.g. "Etch Time"
    requirement: Mapped[str] = mapped_column(String(160), default="")  # e.g. "2.0–10.0 min"
    value_text: Mapped[str] = mapped_column(String(120), default="")  # measured value as recorded
    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    recorded_by: Mapped[str] = mapped_column(String(120), default="")
    recorded_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    # explicit disposition of a failed result (quality role only)
    resolved_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    job = relationship("Job", back_populates="spec_results")
