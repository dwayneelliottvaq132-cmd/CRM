import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.drawing import DrawingAnalysis
from app.models.order import Order
from app.models.purchase_order import PurchaseOrderAnalysis
from app.models.user import User
from app.schemas.purchase_order import (
    GenerateSalesOrderRequest,
    GenerateSalesOrderResult,
    LineResult,
    PurchaseOrderAiStatus,
    PurchaseOrderAnalysisOut,
    PurchaseOrderAnalysisWithDrawingsOut,
)
from app.services import purchase_order_analysis_service, storage_service
from app.services.exceptions import BusinessRuleError

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"], dependencies=[Depends(get_current_user)])


@router.get("/status", response_model=PurchaseOrderAiStatus)
def ai_status() -> dict:
    return purchase_order_analysis_service.status()


@router.get("", response_model=list[PurchaseOrderAnalysisOut])
def list_analyses(db: Session = Depends(get_db)) -> list[PurchaseOrderAnalysis]:
    return purchase_order_analysis_service.list_analyses(db)


@router.get("/{analysis_id}", response_model=PurchaseOrderAnalysisWithDrawingsOut)
def get_analysis(analysis_id: int, db: Session = Depends(get_db)) -> PurchaseOrderAnalysis:
    analysis = db.get(PurchaseOrderAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(404, "Analysis not found")
    matched_ids = {item.get("matched_drawing_analysis_id") for item in (analysis.line_items or [])} - {None}
    matched_drawings = (
        db.execute(select(DrawingAnalysis).where(DrawingAnalysis.id.in_(matched_ids))).scalars().all()
        if matched_ids else []
    )
    out = PurchaseOrderAnalysisWithDrawingsOut.model_validate(analysis)
    out.matched_drawings = matched_drawings
    return out


@router.get("/{analysis_id}/file")
def download_po_file(analysis_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    analysis = db.get(PurchaseOrderAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(404, "Analysis not found")
    data = storage_service.load_pdf(analysis.stored_file_path)
    if data is None:
        raise HTTPException(404, "No stored file for this analysis")
    return StreamingResponse(
        io.BytesIO(data), media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{analysis.filename}"'},
    )


@router.post("/analyze", response_model=PurchaseOrderAnalysisWithDrawingsOut)
async def analyze_purchase_order(
    po_file: UploadFile,
    drawing_files: list[UploadFile] = [],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchaseOrderAnalysisWithDrawingsOut:
    """Scan a customer PO PDF (and optionally its attached drawing PDFs) with Claude:
    extract PO number/line items/requirements, scan each drawing through the existing AI
    Drawing Scan, and best-effort match each drawing to a line by part number. Nothing is
    created in Orders/Travelers yet — review the result and call /generate."""
    if not purchase_order_analysis_service.status()["configured"]:
        raise HTTPException(503, purchase_order_analysis_service.status()["detail"])
    po_data = await po_file.read()
    try:
        analysis = purchase_order_analysis_service.analyze_po(
            db, filename=po_file.filename or "purchase_order.pdf", data=po_data, actor=user.name
        )
    except BusinessRuleError as exc:
        db.commit()  # keep the Error row + audit trail for traceability
        raise HTTPException(422, str(exc)) from exc

    drawing_files = drawing_files or []
    files = [(f.filename or "drawing.pdf", await f.read()) for f in drawing_files if f.filename]
    matched_drawings = purchase_order_analysis_service.analyze_attached_drawings(db, files=files, actor=user.name)
    purchase_order_analysis_service.match_drawings_to_lines(analysis, matched_drawings)
    db.flush()
    db.commit()

    out = PurchaseOrderAnalysisWithDrawingsOut.model_validate(analysis)
    out.matched_drawings = matched_drawings
    return out


@router.post("/{analysis_id}/generate", response_model=GenerateSalesOrderResult, status_code=201)
def generate_sales_order(
    analysis_id: int,
    body: GenerateSalesOrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GenerateSalesOrderResult:
    """Human-confirmed generate step: creates one Sales Order with one Order Line per
    confirmed line, and one Work Order (Job) per line — reusing the same routing
    resolution a manual Order conversion uses. A line without a Released routing plan but
    with a matched drawing gets a Draft plan auto-built from that drawing for review."""
    analysis = db.get(PurchaseOrderAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(404, "Analysis not found")
    if analysis.status != "Complete":
        raise HTTPException(409, f"Cannot generate from a {analysis.status.lower()} analysis")
    if not body.lines:
        raise HTTPException(422, "At least one line item is required")

    confirmed = [
        purchase_order_analysis_service.ConfirmedLine(
            line_no=line.line_no, part_number=line.part_number, revision=line.revision, spec=line.spec,
            description=line.description, qty=line.qty, unit_price=line.unit_price, due_date=line.due_date,
            drawing_analysis_id=line.drawing_analysis_id, line_requirements=line.line_requirements,
        )
        for line in body.lines
    ]

    try:
        order, line_results = purchase_order_analysis_service.generate_sales_order(
            db, po_analysis=analysis, customer_id=body.customer_id, customer_po=body.customer_po,
            lines=confirmed, actor=user.name,
        )
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc

    db.commit()
    order = db.execute(
        select(Order).options(selectinload(Order.customer), selectinload(Order.lines)).where(Order.id == order.id)
    ).scalar_one()
    return GenerateSalesOrderResult(
        order=order,
        line_results=[LineResult(line_no=r.line_no, job_id=r.job_id, error=r.error) for r in line_results],
    )
