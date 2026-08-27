import datetime as dt

from app.schemas.common import ORMModel
from app.schemas.customer import CustomerOut


class OrderLineOut(ORMModel):
    id: int
    description: str
    qty: int
    unit_price: float
    part_number: str | None = None
    revision: str | None = None
    spec: str | None = None
    job_id: str | None = None


class ContractReviewOut(ORMModel):
    id: int
    order_id: str
    customer_requirements_reviewed: bool
    spec_and_revision_confirmed: bool
    special_requirements_understood: bool
    regulatory_itar_reviewed: bool
    approved_process_available: bool
    capacity_confirmed: bool
    differences_resolved: bool
    governing_spec: str
    spec_revision: str
    captured_requirements: list | None
    outcome: str
    reviewed_by: str | None
    reviewed_at: dt.datetime | None
    notes: str


class ContractReviewUpdate(ORMModel):
    customer_requirements_reviewed: bool | None = None
    spec_and_revision_confirmed: bool | None = None
    special_requirements_understood: bool | None = None
    regulatory_itar_reviewed: bool | None = None
    approved_process_available: bool | None = None
    capacity_confirmed: bool | None = None
    differences_resolved: bool | None = None
    governing_spec: str | None = None
    spec_revision: str | None = None
    captured_requirements: list | None = None
    notes: str | None = None


class OrderOut(ORMModel):
    id: str
    kind: str
    customer: CustomerOut
    customer_po: str
    part_number: str
    spec: str
    qty: int
    value: float
    due_date: dt.date | None
    status: str
    converted_job_id: str | None
    purchase_order_analysis_id: int | None = None
    lines: list[OrderLineOut] = []
    contract_review: ContractReviewOut | None = None


class OrderCreate(ORMModel):
    id: str | None = None  # auto-generated (SO-YY-#### / QT-YY-####) if omitted
    kind: str  # order | quote
    customer_id: int
    customer_po: str
    part_number: str
    spec: str
    qty: int
    value: float
    due_date: dt.date | None = None
    status: str = "Queued"


class OrderUpdate(ORMModel):
    customer_po: str | None = None
    part_number: str | None = None
    spec: str | None = None
    qty: int | None = None
    value: float | None = None
    due_date: dt.date | None = None
