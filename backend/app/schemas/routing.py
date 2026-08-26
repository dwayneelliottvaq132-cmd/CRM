import datetime as dt

from pydantic import field_validator

from app.schemas.common import ORMModel

PARAMETER_KINDS = ("numeric", "duration", "text")


class RequiredParameter(ORMModel):
    """Defines a process variable that must be recorded when a step is signed off,
    e.g. immersion time or tank temperature. Associated to a recorded reading by `key`
    (not row id — RoutingStep and JobOperation are independent, dict-copied rows)."""

    key: str
    label: str
    kind: str = "numeric"  # numeric | duration | text
    unit: str = ""
    target_min: float | None = None
    target_max: float | None = None
    target_text: str | None = None
    auto_computed: bool = False  # duration only — computed server-side from started_at/signed_at
    required: bool = True  # if True, missing or out-of-spec blocks sign-off

    @field_validator("kind")
    @classmethod
    def _valid_kind(cls, v: str) -> str:
        if v not in PARAMETER_KINDS:
            raise ValueError(f"kind must be one of {PARAMETER_KINDS}")
        return v


class RoutingStepIn(ORMModel):
    seq: int
    name: str
    parameters: str = ""
    work_instruction_doc_no: str | None = None
    tank_id: str | None = None
    equipment_id: str | None = None
    is_final_inspect: bool = False
    required_parameters: list[RequiredParameter] = []

    @field_validator("required_parameters", mode="before")
    @classmethod
    def _none_to_empty(cls, v: list | None) -> list:
        # the JSONB column is nullable — existing/pre-migration rows read back as None
        return v or []

    @field_validator("required_parameters")
    @classmethod
    def _unique_keys(cls, v: list[RequiredParameter]) -> list[RequiredParameter]:
        keys = [p.key for p in v]
        if len(keys) != len(set(keys)):
            raise ValueError("required_parameters keys must be unique within a step")
        return v


class RoutingStepOut(RoutingStepIn):
    id: int


class RoutingRevisionOut(ORMModel):
    id: int
    routing_template_id: str | None
    part_id: int | None
    revision_number: int
    status: str
    cloned_from_revision_id: int | None
    source_drawing_analysis_id: int | None
    created_by: str
    created_at: dt.datetime
    released_by: str | None
    released_at: dt.datetime | None
    superseded_at: dt.datetime | None


class RoutingRevisionDetailOut(RoutingRevisionOut):
    steps: list[RoutingStepOut]


class RoutingRevisionCreate(ORMModel):
    steps: list[RoutingStepIn] | None = None
    clone_from_revision_id: int | None = None


class StepsReplace(ORMModel):
    steps: list[RoutingStepIn]


class GenerateFromPoRequest(ORMModel):
    attach_to_template_id: str | None = None


class RoutingTemplateOut(ORMModel):
    id: str
    name: str
    spec: str
    active: bool


class RoutingTemplateCreate(ORMModel):
    name: str
    spec: str


class RoutingTemplateUpdate(ORMModel):
    name: str | None = None
    spec: str | None = None


class PartOut(ORMModel):
    id: int
    customer_id: int
    part_number: str
    revision: str
    spec: str
    itar: bool
    active: bool


class PartCreate(ORMModel):
    customer_id: int
    part_number: str
    revision: str
    spec: str
    itar: bool = False


class PartUpdate(ORMModel):
    spec: str | None = None
    itar: bool | None = None
