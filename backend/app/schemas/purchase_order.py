import datetime as dt

from app.schemas.common import ORMModel
from app.schemas.drawing import DrawingAnalysisOut
from app.schemas.order import OrderOut


class PurchaseOrderAnalysisOut(ORMModel):
    id: int
    filename: str
    file_size: int
    status: str
    po_number: str | None
    po_date: dt.date | None
    customer_name_guess: str | None
    general_requirements: list | None
    line_items: list | None
    warnings: list | None
    error_detail: str | None
    model_used: str | None
    created_by: str
    created_at: dt.datetime
    stored_file_path: str | None


class PurchaseOrderAnalysisWithDrawingsOut(PurchaseOrderAnalysisOut):
    matched_drawings: list[DrawingAnalysisOut] = []


class PurchaseOrderAiStatus(ORMModel):
    configured: bool
    model: str
    detail: str


class ConfirmedLineIn(ORMModel):
    line_no: int
    part_number: str
    revision: str = "A"
    spec: str
    description: str = ""
    qty: int
    unit_price: float = 0
    due_date: dt.date | None = None
    drawing_analysis_id: int | None = None
    line_requirements: list[str] = []


class GenerateSalesOrderRequest(ORMModel):
    customer_id: int
    customer_po: str | None = None  # falls back to the analysis's extracted po_number
    lines: list[ConfirmedLineIn]


class LineResult(ORMModel):
    line_no: int
    job_id: str | None
    error: str | None


class GenerateSalesOrderResult(ORMModel):
    order: OrderOut
    line_results: list[LineResult]
