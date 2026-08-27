import datetime as dt

from app.schemas.common import ORMModel


class CustomerOut(ORMModel):
    id: int
    name: str
    itar_registered: bool
    active: bool = True
    require_approved_routing: bool = False
    requires_contract_review: bool = False
    quality_standards: str = ""


class CustomerCreate(ORMModel):
    name: str
    itar_registered: bool = False
    require_approved_routing: bool = False
    requires_contract_review: bool = False
    quality_standards: str = ""


class CustomerUpdate(ORMModel):
    name: str | None = None
    itar_registered: bool | None = None
    require_approved_routing: bool | None = None
    requires_contract_review: bool | None = None
    quality_standards: str | None = None


class VendorOut(ORMModel):
    id: int
    name: str
    category: str
    approval_basis: str
    otd_pct: float
    survey_due_at: dt.date | None
    survey_overdue: bool
    status: str
    active: bool = True


class VendorCreate(ORMModel):
    name: str
    category: str
    approval_basis: str
    otd_pct: float = 100.0
    survey_due_at: dt.date | None = None
    status: str = "Approved"


class VendorUpdate(ORMModel):
    name: str | None = None
    category: str | None = None
    approval_basis: str | None = None
    otd_pct: float | None = None
    survey_due_at: dt.date | None = None
    status: str | None = None
