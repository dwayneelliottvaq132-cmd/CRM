"""AI purchase order analysis — scans a customer PO PDF with Claude and extracts the PO
number/date, a best-guess customer name (a human still confirms the real Customer before
anything is created), PO-wide special requirements (Certificate of Conformance, source
inspection, FAI, ...), and one entry per line item (part number, revision, qty, spec).

Also drives auto-generation: once a human reviews and confirms the extracted lines,
generate_sales_order() creates one Order (with one OrderLine per confirmed line) and one Job
per line via order_service._build_job_from_line — same job-creation path a manual Order-to-
Job conversion uses, looped over every line independently so one line's failure doesn't
block the others. Every job lands in planning_status="Needs Planning"; routing is no longer
resolved here — a person completes that in the Planning module, where the matched drawing
scan (line.drawing_analysis_id, carried onto the job) and the PO's own structured processing
requirements are both available to populate the traveler.

Uses the Anthropic Messages API exactly like drawing_analysis_service — same base64 PDF
`document` content block + JSON-schema structured output. Without ANTHROPIC_API_KEY set the
endpoint reports "not configured"; results are never fabricated."""

import base64
import datetime as dt
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.customer import Customer
from app.models.drawing import DrawingAnalysis
from app.models.order import Order, OrderLine
from app.models.purchase_order import PurchaseOrderAnalysis
from app.services import audit_service, drawing_analysis_service, id_service, routing_service, storage_service
from app.services.exceptions import BusinessRuleError

settings = get_settings()

MAX_PDF_BYTES = 30 * 1024 * 1024

RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "po_number": {"type": ["string", "null"], "description": "The purchase order number"},
        "po_date": {"type": ["string", "null"], "description": "PO date in YYYY-MM-DD if present, else null"},
        "customer_name_guess": {"type": ["string", "null"], "description": "The buyer's company name as printed on the PO (bill-to/ship-from company, not the vendor being ordered from)"},
        "general_requirements": {
            "type": "array",
            "description": "PO-wide special requirements not tied to one line item — e.g. 'Certificate of Conformance required', 'Source inspection required', 'AS9102 First Article Inspection required', 'No substitutions without written approval'",
            "items": {"type": "string"},
        },
        "line_items": {
            "type": "array",
            "description": "Every line item on the PO",
            "items": {
                "type": "object",
                "properties": {
                    "line_no": {"type": "integer"},
                    "part_number": {"type": ["string", "null"]},
                    "revision": {"type": ["string", "null"], "description": "Engineering revision letter if stated, else null"},
                    "description": {"type": "string"},
                    "qty": {"type": ["integer", "null"]},
                    "unit_price": {"type": ["number", "null"]},
                    "due_date": {"type": ["string", "null"], "description": "YYYY-MM-DD if present, else null"},
                    "spec_text": {"type": ["string", "null"], "description": "Governing spec exactly as written on this line, if the PO states one directly (e.g. 'MIL-DTL-5541 Type I Class 1A'), else null"},
                    "drawing_ref_text": {"type": ["string", "null"], "description": "Any drawing number/revision referenced for this line, e.g. 'per DWG 10847-3 Rev B'"},
                    "line_requirements": {
                        "type": "array",
                        "description": "Special requirements specific to this line only",
                        "items": {"type": "string"},
                    },
                    "processing_requirements": {
                        "type": "array",
                        "description": "Structured finish/plating requirements stated directly on this line (e.g. 'Anodize per MIL-A-8625 Type II Class 1', 'Chem film per MIL-DTL-5541 Type I Class 3') — used to draft a traveler automatically. Leave empty if the PO only references a drawing for processing details rather than stating a spec itself.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "process": {"type": ["string", "null"], "description": "e.g. 'Anodize', 'Chem Film', 'Passivate'"},
                                "spec": {"type": ["string", "null"]},
                                "class_type": {"type": ["string", "null"], "description": "Type/Class/Grade as stated"},
                                "notes": {"type": ["string", "null"]},
                            },
                            "required": ["process", "spec", "class_type", "notes"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["line_no", "part_number", "revision", "description", "qty", "unit_price", "due_date", "spec_text", "drawing_ref_text", "line_requirements", "processing_requirements"],
                "additionalProperties": False,
            },
        },
        "warnings": {
            "type": "array",
            "description": "Anything a reviewer must double-check: illegible line items, missing part numbers, ambiguous quantities/specs",
            "items": {"type": "string"},
        },
    },
    "required": ["po_number", "po_date", "customer_name_guess", "general_requirements", "line_items", "warnings"],
    "additionalProperties": False,
}

PROMPT = """You are reviewing a customer purchase order for a NADCAP-accredited metal finishing
job shop (anodize, chem film, passivation, electro/electroless plating, prime & paint). Extract,
from the attached PDF purchase order:

1. PO NUMBER, PO DATE, and the BUYER'S company name (the customer issuing this PO to us, not
   our own company name if it appears as the vendor/recipient).

2. GENERAL REQUIREMENTS — special requirements that apply to the whole PO rather than one line:
   Certificate of Conformance, source inspection, AS9102 First Article Inspection, no material
   substitutions, packaging/marking requirements, etc. Only report what's actually stated —
   never infer a requirement that isn't written on the PO.

3. LINE ITEMS — every line, in order: part number, revision (if stated), description, quantity,
   unit price, due/need date, and the governing spec if the PO states one directly on that line
   (many POs just reference "per drawing" instead — in that case leave spec_text null, a
   separately-scanned drawing will supply it). Capture any drawing number/revision referenced for
   that line in drawing_ref_text exactly as written, and any line-specific special requirements
   separately from the PO-wide ones. If the line states a finish/plating spec directly (not just
   "per drawing"), also break it out into processing_requirements (process, spec, class_type,
   notes) — this feeds an automatically-drafted traveler, so only report what's explicitly
   written; never infer a process that isn't stated.

Flag anything illegible, ambiguous, or a line item missing a part number as a warning rather than
guessing silently."""


def _get_client():
    import anthropic

    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def status() -> dict:
    if not settings.ai_configured:
        return {
            "configured": False,
            "model": settings.anthropic_model,
            "detail": "No ANTHROPIC_API_KEY configured — purchase order analysis is disabled. "
                      "Set the key in backend/.env to enable.",
        }
    return {"configured": True, "model": settings.anthropic_model, "detail": "Ready"}


def _parse_date(raw: str | None) -> dt.date | None:
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(raw)
    except ValueError:
        return None


def analyze_po(db: Session, *, filename: str, data: bytes, actor: str) -> PurchaseOrderAnalysis:
    if not settings.ai_configured:
        raise BusinessRuleError("AI purchase order analysis is not configured — set ANTHROPIC_API_KEY in backend/.env")
    if not data:
        raise BusinessRuleError("Empty file")
    if len(data) > MAX_PDF_BYTES:
        raise BusinessRuleError("PDF is too large (30 MB max)")
    if not data.startswith(b"%PDF"):
        raise BusinessRuleError("File does not look like a PDF")

    analysis = PurchaseOrderAnalysis(
        filename=filename[:255], file_size=len(data), status="Error",
        created_by=actor, model_used=settings.anthropic_model,
    )
    db.add(analysis)
    db.flush()
    analysis.stored_file_path = storage_service.save_pdf("purchase_orders", analysis.id, data)
    db.flush()

    client = _get_client()
    try:
        with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=8192,
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema", "schema": RESULT_SCHEMA}},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(data).decode()},
                        },
                        {"type": "text", "text": PROMPT},
                    ],
                }
            ],
        ) as stream:
            message = stream.get_final_message()
        text = "".join(block.text for block in message.content if block.type == "text")
        result = json.loads(text)
    except Exception as exc:  # noqa: BLE001 — record the failure, then surface it
        analysis.error_detail = str(exc)[:2000]
        db.flush()
        audit_service.record(
            db, actor=actor, action="po_analysis_error", entity_type="purchase_order_analysis",
            entity_id=str(analysis.id), after={"filename": filename, "error": analysis.error_detail[:400]},
        )
        raise BusinessRuleError(f"Purchase order analysis failed: {exc}") from exc

    line_items = result.get("line_items") or []
    for item in line_items:
        item["matched_drawing_analysis_id"] = None

    analysis.status = "Complete"
    analysis.po_number = (result.get("po_number") or None) and str(result["po_number"])[:60]
    analysis.po_date = _parse_date(result.get("po_date"))
    analysis.customer_name_guess = (result.get("customer_name_guess") or None) and str(result["customer_name_guess"])[:200]
    analysis.general_requirements = result.get("general_requirements") or []
    analysis.line_items = line_items
    analysis.warnings = result.get("warnings") or []
    analysis.raw_result = result
    db.flush()

    audit_service.record(
        db, actor=actor, action="po_analysis", entity_type="purchase_order_analysis", entity_id=str(analysis.id),
        after={"filename": filename, "po_number": analysis.po_number, "line_count": len(line_items)},
    )
    return analysis


def analyze_attached_drawings(db: Session, *, files: list[tuple[str, bytes]], actor: str) -> list[DrawingAnalysis]:
    """Scans each attached drawing through the existing, unmodified drawing analysis
    service — no duplicated extraction logic. A per-file failure is recorded (as an Error
    DrawingAnalysis row, same as a manual bad-upload) but doesn't abort the others."""
    results: list[DrawingAnalysis] = []
    for filename, data in files:
        try:
            results.append(drawing_analysis_service.analyze_pdf(db, filename=filename, data=data, actor=actor))
        except BusinessRuleError:
            continue
    return results


def _normalize_part_number(raw: str | None) -> str:
    return (raw or "").strip().upper()


def match_drawings_to_lines(po_analysis: PurchaseOrderAnalysis, drawings: list[DrawingAnalysis]) -> None:
    """Pure matching step: sets matched_drawing_analysis_id on each line item by exact
    (normalized) part-number match. Unmatched lines/drawings are left None — the review UI
    lets a human pick manually. Reassigns po_analysis.line_items to a new list (rather than
    mutating the existing dicts in place) since SQLAlchemy doesn't detect in-place mutation
    of a JSONB column — same convention as drawing_analysis_service._recompute_dimensions."""
    by_part_number: dict[str, DrawingAnalysis] = {}
    for d in drawings:
        key = _normalize_part_number(d.part_number)
        if key:
            by_part_number[key] = d
    updated = []
    for item in po_analysis.line_items or []:
        item = dict(item)
        match = by_part_number.get(_normalize_part_number(item.get("part_number")))
        item["matched_drawing_analysis_id"] = match.id if match else None
        updated.append(item)
    po_analysis.line_items = updated


def list_analyses(db: Session) -> list[PurchaseOrderAnalysis]:
    return db.execute(select(PurchaseOrderAnalysis).order_by(PurchaseOrderAnalysis.created_at.desc())).scalars().all()


class ConfirmedLine:
    """Plain container mirroring schemas.purchase_order.ConfirmedLineIn — kept
    framework-agnostic so this service doesn't import the API layer's Pydantic models."""

    def __init__(self, *, line_no, part_number, revision, spec, description, qty, unit_price, due_date, drawing_analysis_id, line_requirements):
        self.line_no = line_no
        self.part_number = part_number
        self.revision = revision
        self.spec = spec
        self.description = description
        self.qty = qty
        self.unit_price = unit_price
        self.due_date = due_date
        self.drawing_analysis_id = drawing_analysis_id
        self.line_requirements = line_requirements


class LineResult:
    def __init__(self, *, line_no, job_id=None, error=None):
        self.line_no = line_no
        self.job_id = job_id
        self.error = error


def generate_sales_order(db: Session, *, po_analysis: PurchaseOrderAnalysis, customer_id: int, customer_po: str | None, lines: list[ConfirmedLine], actor: str) -> tuple[Order, list[LineResult]]:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise BusinessRuleError(f"Customer {customer_id} not found")

    order_id = id_service.next_id(db, Order, f"SO-{dt.date.today():%y}-", 4)
    order = Order(
        id=order_id, kind="order", customer_id=customer_id,
        customer_po=(customer_po or po_analysis.po_number or "")[:60],
        part_number=lines[0].part_number if lines else "",
        spec=lines[0].spec if lines else "",
        qty=sum(l.qty for l in lines) if lines else 0,
        value=sum((l.unit_price or 0) * (l.qty or 0) for l in lines),
        due_date=min((l.due_date for l in lines if l.due_date), default=None),
        status="Queued",
        purchase_order_analysis_id=po_analysis.id,  # keep the scanned PO linked for reference
    )
    db.add(order)
    db.flush()

    # Create the order lines up front (independent of whether jobs get created now).
    order_lines: list[OrderLine] = []
    for line in lines:
        ol = OrderLine(
            order_id=order.id, description=line.description[:255], qty=line.qty,
            unit_price=line.unit_price or 0, part_number=line.part_number[:60],
            revision=line.revision[:10], spec=line.spec[:120],
        )
        db.add(ol)
        order_lines.append(ol)
    db.flush()

    # Seed the contract-review record (captured requirements come from the linked PO).
    from app.services import order_service
    order_service.get_or_create_review(db, order)

    # AS9100 §8.2.3 gate: for a customer that requires contract review, stop here — the order
    # sits in "Pending Contract Review" and no work orders are created until it's accepted.
    if customer.requires_contract_review:
        order.status = "Pending Contract Review"
        db.flush()
        audit_service.record(
            db, actor=actor, action="generate_sales_order", entity_type="order", entity_id=order.id,
            after={"po_analysis_id": po_analysis.id, "line_count": len(lines), "pending_contract_review": True},
        )
        return order, [LineResult(line_no=l.line_no, job_id=None, error="Pending contract review") for l in lines]

    # Local import avoids a circular import (order_service doesn't import this module).
    from app.services import order_service

    line_results: list[LineResult] = []
    jobs_created = []
    for line, order_line in zip(lines, order_lines):
        try:
            routing_service.get_or_create_part(db, customer_id=customer_id, part_number=line.part_number, revision=line.revision, spec=line.spec)

            job = order_service._build_job_from_line(
                db, order=order, customer=customer, part_number=line.part_number, revision=line.revision,
                spec=line.spec, qty=line.qty, due_date=line.due_date,
                po_requirements=(po_analysis.general_requirements or []) + (line.line_requirements or []),
                order_line=order_line, source_drawing_analysis_id=line.drawing_analysis_id,
            )
            jobs_created.append(job)
            line_results.append(LineResult(line_no=line.line_no, job_id=job.id))
        except BusinessRuleError as exc:
            line_results.append(LineResult(line_no=line.line_no, error=str(exc)))

    # Mirror create_work_orders_for_order: reflect the real outcome on the order itself
    # rather than leaving it "Queued" forever once its lines actually became jobs.
    if jobs_created:
        order.status = "Converted"
        if len(jobs_created) == 1:
            order.converted_job_id = jobs_created[0].id
        db.flush()

    audit_service.record(
        db, actor=actor, action="generate_sales_order", entity_type="order", entity_id=order.id,
        after={"po_analysis_id": po_analysis.id, "line_count": len(lines), "jobs_created": [r.job_id for r in line_results if r.job_id]},
    )
    return order, line_results
