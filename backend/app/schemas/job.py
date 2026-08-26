import datetime as dt

from pydantic import field_validator

from app.schemas.common import ORMModel
from app.schemas.customer import CustomerOut
from app.schemas.drawing import DrawingAnalysisOut
from app.schemas.routing import PartOut, RequiredParameter, RoutingTemplateOut


class RecordedParameter(ORMModel):
    key: str
    label: str
    unit: str = ""
    kind: str = "numeric"
    value: float | str
    target_min: float | None = None
    target_max: float | None = None
    target_text: str | None = None
    in_spec: bool | None = None
    recorded_by: str
    recorded_at: dt.datetime


class ParameterReading(ORMModel):
    key: str
    value: float | str


class JobOperationOut(ORMModel):
    id: int
    seq: int
    name: str
    parameters: str
    work_instruction_doc_no: str | None
    tank_id: str | None
    equipment_id: str | None
    source_routing_step_id: int | None = None
    done: bool
    signed_by: str | None
    signed_at: dt.datetime | None
    started_at: dt.datetime | None
    tank_ooc_at_signoff: bool
    is_final_inspect: bool = False
    required_parameters: list[RequiredParameter] = []
    recorded_parameters: list[RecordedParameter] = []
    has_out_of_spec_reading: bool = False

    @field_validator("required_parameters", "recorded_parameters", mode="before")
    @classmethod
    def _none_to_empty(cls, v: list | None) -> list:
        # both are nullable JSONB columns — existing/pre-migration rows read back as None
        return v or []


class JobOut(ORMModel):
    id: str
    customer: CustomerOut
    customer_po: str
    part_number: str
    revision: str
    qty: int
    material_lot: str
    process_label: str
    spec: str
    spec_note: str
    due_date: dt.date | None
    due_note: str
    itar: bool
    status: str
    governing_doc_no: str | None
    source_routing_revision_id: int | None = None
    routing_warning: str | None = None
    routing_planned: bool = False
    source_routing_revision_label: str | None = None
    po_requirements: list[str] = []
    planning_status: str = "Planned"
    source_drawing_analysis_id: int | None = None
    current_op_seq: int | None = None
    current_op_name: str | None = None
    current_op_tank_id: str | None = None
    current_op_equipment_id: str | None = None

    @field_validator("po_requirements", mode="before")
    @classmethod
    def _none_to_empty(cls, v: list | None) -> list:
        return v or []


class SpecResultOut(ORMModel):
    id: int
    param_key: str
    name: str
    requirement: str
    value_text: str
    passed: bool
    recorded_by: str
    recorded_at: dt.datetime
    resolved_by: str | None
    resolved_at: dt.datetime | None
    resolution_note: str | None


class JobDetailOut(JobOut):
    ops: list[JobOperationOut]
    spec_results: list[SpecResultOut]
    ship_ready: bool
    ship_blockers: list[str]


class JobCreate(ORMModel):
    customer_id: int
    customer_po: str
    part_number: str
    revision: str = "A"
    qty: int
    spec: str
    process_label: str | None = None
    due_date: dt.date | None = None
    itar: bool = False


class JobUpdate(ORMModel):
    customer_po: str | None = None
    part_number: str | None = None
    revision: str | None = None
    qty: int | None = None
    spec: str | None = None
    due_date: dt.date | None = None
    itar: bool | None = None


class PinRequest(ORMModel):
    pin: str


class OperatorOut(ORMModel):
    name: str


class SignoffRequest(ORMModel):
    pin: str
    readings: list[ParameterReading] = []


class BatchSignoffRequest(ORMModel):
    job_ids: list[str]
    pin: str
    readings: list[ParameterReading] = []


class ResolveSpecRequest(ORMModel):
    note: str


class ReportProblemRequest(ORMModel):
    pin: str
    description: str


class JobPlanningContextOut(ORMModel):
    """Bundles everything the Planning module needs for one job into a single call:
    the job itself, its (possibly just-created) Part, any active templates matching
    the linked drawing's and/or PO line's governing specs, the linked drawing scan, the
    originating PO line (if this job came from a scanned PO), and a spec_mismatch
    warning when the part already has a plan built for a different spec — the drawing
    and PO line are what "populate" the traveler-building step."""

    job: JobOut
    part: PartOut
    matching_templates: list[RoutingTemplateOut] = []
    drawing: DrawingAnalysisOut | None = None
    po_line: dict | None = None
    spec_mismatch: str | None = None
