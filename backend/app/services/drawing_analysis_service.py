"""AI drawing analysis — scans a customer PDF drawing with Claude and extracts
the two things quoting needs from every print: what processing the drawing
calls out (finish/plating specs, classes, masking) and the part's estimated
surface area (chemical processing is priced by area).

Uses the Anthropic Messages API with a base64 PDF `document` content block and
a JSON-schema structured output, so the response is machine-parseable. Without
ANTHROPIC_API_KEY set the endpoint reports "not configured" — results are never
fabricated (unlike QuickBooks sync, a simulated drawing analysis would put fake
engineering data in front of a quoting decision)."""

import base64
import json
import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.drawing import DrawingAnalysis
from app.services import audit_service, storage_service
from app.services.exceptions import BusinessRuleError

settings = get_settings()

MAX_PDF_BYTES = 30 * 1024 * 1024  # Messages API PDF limit ~32 MB / 100 pages

RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "part_number": {"type": ["string", "null"], "description": "Part number from the title block"},
        "revision": {"type": ["string", "null"], "description": "Drawing revision letter/number"},
        "material": {"type": ["string", "null"], "description": "Base material and alloy/temper, e.g. 'Aluminum 6061-T6'"},
        "processing_requirements": {
            "type": "array",
            "description": "Every surface-treatment / finish callout a chemical processor must perform",
            "items": {
                "type": "object",
                "properties": {
                    "process": {"type": "string", "description": "Plain-language process, e.g. 'Anodize Type II'"},
                    "spec": {"type": "string", "description": "Governing spec exactly as written, e.g. 'MIL-A-8625F'"},
                    "class_type": {"type": "string", "description": "Type/class/method/grade qualifiers, e.g. 'Type II, Class 2, black'"},
                    "notes": {"type": "string", "description": "Thickness, color, dye, seal, location-specific notes"},
                },
                "required": ["process", "spec", "class_type", "notes"],
                "additionalProperties": False,
            },
        },
        "governing_specs": {
            "type": "array",
            "description": "All specs/standards referenced on the drawing (incl. non-finish ones)",
            "items": {
                "type": "object",
                "properties": {
                    "spec": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["spec", "description"],
                "additionalProperties": False,
            },
        },
        "masking_requirements": {
            "type": "array",
            "description": "Areas/features called out to be masked, plugged, or kept free of coating",
            "items": {"type": "string"},
        },
        "post_treatment_requirements": {
            "type": "array",
            "description": "Post-plating/finishing requirements called out separately from the finish itself — "
            "e.g. hydrogen embrittlement relief bake, stress relief, shot peen, passivation after plate",
            "items": {
                "type": "object",
                "properties": {
                    "treatment": {"type": "string", "description": "e.g. 'Hydrogen Embrittlement Relief Bake'"},
                    "spec": {"type": "string", "description": "Governing spec exactly as written, e.g. 'AMS 2759/9'"},
                    "notes": {"type": "string", "description": "Timing/temperature/duration window, e.g. 'within 4 hours of plating, 375°F ±25°F, 23 hr min'"},
                },
                "required": ["treatment", "spec", "notes"],
                "additionalProperties": False,
            },
        },
        "dimensions": {
            "type": "array",
            "description": "Exhaustive per-feature decomposition used for the surface-area estimate — the sum of "
            "every entry's area_sq_in must equal your total surface_area_sq_in. For a REGULAR shape (a circular "
            "hole/bore wall, or a flat rectangular face), set 'shape' and fill in 'params' with the raw measured "
            "numbers instead of computing the area yourself — the application computes that area deterministically "
            "from your numbers so it can't be arithmetic-wrong. Only fall back to reporting area_sq_in directly "
            "(leaving shape null) for irregular geometry a simple formula can't capture (ovals, stadiums, fillets, "
            "complex per-print contours) — in that case area_sq_in is your own best estimate.",
            "items": {
                "type": "object",
                "properties": {
                    "feature": {"type": "string", "description": "e.g. 'overall envelope', 'bore Ø0.500 x 1.2 deep'"},
                    "dimensions_text": {"type": "string", "description": "The dimensions as read, with units"},
                    "shape": {
                        "anyOf": [
                            {"type": "string", "enum": ["circular_hole_wall", "rect_face"]},
                            {"type": "null"},
                        ],
                        "description": "Set only for regular geometry the app can compute exactly; null for irregular/complex shapes",
                    },
                    "params": {
                        "type": ["object", "null"],
                        "description": "Required when shape is set; null otherwise. circular_hole_wall needs diameter_in+depth_in+count; rect_face needs length_in+width_in+count.",
                        "properties": {
                            "diameter_in": {"type": ["number", "null"]},
                            "depth_in": {"type": ["number", "null"]},
                            "length_in": {"type": ["number", "null"]},
                            "width_in": {"type": ["number", "null"]},
                            "count": {"type": ["integer", "null"], "description": "Number of identical instances of this feature, e.g. 4 for '4x Ø0.37 THRU'"},
                        },
                        "required": ["diameter_in", "depth_in", "length_in", "width_in", "count"],
                        "additionalProperties": False,
                    },
                    "area_sq_in": {
                        "type": ["number", "null"],
                        "description": "This feature's contribution in in² — your own estimate; ignored/recomputed by the app when shape+params are set",
                    },
                },
                "required": ["feature", "dimensions_text", "shape", "params", "area_sq_in"],
                "additionalProperties": False,
            },
        },
        "surface_area_sq_in": {
            "type": ["number", "null"],
            "description": "Estimated TOTAL wetted surface area of one part in square inches (all faces incl. holes/bores) — "
            "must equal the sum of the dimensions[] breakdown",
        },
        "surface_area_method": {
            "type": "string",
            "description": "How the estimate was computed: geometry assumed, faces summed, what was ignored",
        },
        "surface_area_confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "overall_thickness_in": {
            "type": ["number", "null"],
            "description": "The single dimension you used as the part's overall height/thickness (the number that most "
            "drives the surface-area estimate, since wall areas scale with it) — reported separately so it can be "
            "flagged distinctly from the rest of the breakdown, since misreading it (e.g. confusing it with a width or "
            "a hole-position span) has an outsized effect on the total.",
        },
        "overall_thickness_source": {
            "type": "string",
            "description": "Exactly which callout/view this came from, e.g. 'Section A-A, labeled 4.00' — and note if "
            "any other view (e.g. the isometric) looks inconsistent with this reading",
        },
        "overall_thickness_confidence": {"type": "string", "enum": ["high", "medium", "low", "n/a"]},
        "warnings": {
            "type": "array",
            "description": "Anything a quoting engineer must double-check: illegible callouts, missing views, ambiguous specs",
            "items": {"type": "string"},
        },
    },
    "required": [
        "part_number", "revision", "material", "processing_requirements", "governing_specs",
        "masking_requirements", "post_treatment_requirements", "dimensions", "surface_area_sq_in",
        "surface_area_method", "surface_area_confidence", "overall_thickness_in", "overall_thickness_source",
        "overall_thickness_confidence", "warnings",
    ],
    "additionalProperties": False,
}

PROMPT = """You are reviewing a customer engineering drawing for a NADCAP-accredited metal
finishing job shop (anodize, chem film, passivation, electro/electroless plating, prime & paint).
Extract, from the attached PDF drawing:

1. PROCESSING REQUIREMENTS — every surface treatment / finish callout this shop would have to
   perform, with the governing spec exactly as written (e.g. MIL-A-8625F Type II Class 2,
   MIL-DTL-5541F, AMS 2700, AMS 2404), including type/class/method, thickness, color/dye,
   seal, and any location-specific finishing notes. Also list masking / keep-free areas.

2. POST-TREATMENT REQUIREMENTS — anything called out separately from the finish itself that must
   happen after (or before) processing: hydrogen embrittlement relief bake (common on high-strength
   steel after plating — look for "BAKE PER AMS 2759", "EMBRITTLEMENT RELIEF", or similar notes),
   stress relief, shot peen, passivation after plate, or any other heat-treat/mechanical requirement
   tied to the finish. Capture the governing spec and the timing/temperature/duration window exactly
   as written — this is a compliance-critical window (e.g. "within 4 hours of plating"), never
   paraphrase it loosely. Leave this empty if the drawing doesn't call anything out — do not infer
   an embrittlement bake just because a process is present; only report what's actually on the print.

3. SURFACE AREA — estimate the total wetted surface area of ONE part in square inches. Read the
   principal dimensions off the views, state the geometry you assume (plate, cylinder, machined
   block…), and build an EXHAUSTIVE per-feature breakdown in `dimensions[]` — every entry's
   area_sq_in must sum to your total surface_area_sq_in; don't include area in the total that
   isn't backed by a line in the breakdown. For each feature:
     - If it's a REGULAR shape — a circular hole/bore wall, or a flat rectangular face — set
       `shape` and fill in `params` (diameter_in+depth_in+count for a hole wall; length_in+width_in
       +count for a rectangular face) with the raw numbers you read off the drawing. Leave
       `area_sq_in` as your own estimate too, but the application will compute the authoritative
       area from your params, not trust your arithmetic — so it's fine (and expected) if your
       area_sq_in is only approximate for these.
     - If it's IRREGULAR (an oval/stadium bore, a filleted contour, anything a simple formula can't
       capture), leave `shape` null and report your best-estimate `area_sq_in` directly, same as
       before.
   If the drawing units are metric, convert to inches. Be explicit about what you ignored (small
   fillets, chamfers, threads) and rate your confidence.

   Separately, report `overall_thickness_in` — the single dimension you used as the part's overall
   height/thickness (not a width, not a hole-position span). This one number usually drives most of
   the total (wall areas scale with it), so misreading it has an outsized effect — double-check it
   against every view that shows it (section views, side views, the isometric if present) before
   settling on it, note the exact callout you used in `overall_thickness_source`, and rate your
   confidence specifically in THIS number via `overall_thickness_confidence` (use "n/a" only if the
   part genuinely has no meaningful single thickness, e.g. a purely 2D sheet-metal flat pattern).

Read the title block for part number, revision, and material. Flag anything illegible or
ambiguous as a warning rather than guessing silently."""


def _get_client():
    import anthropic

    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _compute_area(shape: str, params: dict) -> float | None:
    """Deterministic area for the regular shapes the AI is asked to decompose into raw
    numbers rather than trusting its own arithmetic. Returns None if params are incomplete."""
    count = params.get("count") or 1
    if shape == "circular_hole_wall":
        diameter, depth = params.get("diameter_in"), params.get("depth_in")
        if diameter is None or depth is None:
            return None
        return math.pi * diameter * depth * count
    if shape == "rect_face":
        length, width = params.get("length_in"), params.get("width_in")
        if length is None or width is None:
            return None
        return length * width * count
    return None


def _recompute_dimensions(dimensions: list[dict]) -> tuple[list[dict], float | None]:
    """Overrides area_sq_in with deterministic math wherever the model reported a regular
    shape+params (removing LLM arithmetic as a source of error for those entries), and sums
    every entry (recomputed or AI-estimated) into an authoritative total. Marks each entry
    `computed: True/False` so the UI can show which numbers are formula-verified vs estimated."""
    fixed: list[dict] = []
    total = 0.0
    any_area = False
    for entry in dimensions:
        entry = dict(entry)
        shape, params = entry.get("shape"), entry.get("params")
        computed_area = _compute_area(shape, params) if shape and params else None
        if computed_area is not None:
            entry["area_sq_in"] = round(computed_area, 3)
            entry["computed"] = True
        else:
            entry["computed"] = False
        if entry.get("area_sq_in") is not None:
            total += entry["area_sq_in"]
            any_area = True
        fixed.append(entry)
    return fixed, (round(total, 2) if any_area else None)


def status() -> dict:
    if not settings.ai_configured:
        return {
            "configured": False,
            "model": settings.anthropic_model,
            "detail": "No ANTHROPIC_API_KEY configured — drawing analysis is disabled. "
                      "Set the key in backend/.env to enable.",
        }
    return {"configured": True, "model": settings.anthropic_model, "detail": "Ready"}


def analyze_pdf(db: Session, *, filename: str, data: bytes, actor: str) -> DrawingAnalysis:
    if not settings.ai_configured:
        raise BusinessRuleError(
            "AI drawing analysis is not configured — set ANTHROPIC_API_KEY in backend/.env"
        )
    if not data:
        raise BusinessRuleError("Empty file")
    if len(data) > MAX_PDF_BYTES:
        raise BusinessRuleError("PDF is too large (30 MB max)")
    if not data.startswith(b"%PDF"):
        raise BusinessRuleError("File does not look like a PDF")

    analysis = DrawingAnalysis(
        filename=filename[:255], file_size=len(data), status="Error",
        created_by=actor, model_used=settings.anthropic_model,
    )
    db.add(analysis)
    db.flush()
    analysis.stored_file_path = storage_service.save_pdf("drawings", analysis.id, data)
    db.flush()

    client = _get_client()
    try:
        # Streaming avoids request timeouts on large drawings; the final message
        # carries the schema-constrained JSON.
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
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": base64.standard_b64encode(data).decode(),
                            },
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
            db, actor=actor, action="drawing_analysis_error", entity_type="drawing_analysis",
            entity_id=str(analysis.id), after={"filename": filename, "error": analysis.error_detail[:400]},
        )
        raise BusinessRuleError(f"Drawing analysis failed: {exc}") from exc

    fixed_dimensions, computed_total = _recompute_dimensions(result.get("dimensions") or [])

    analysis.status = "Complete"
    analysis.part_number = (result.get("part_number") or None) and str(result["part_number"])[:120]
    analysis.revision = (result.get("revision") or None) and str(result["revision"])[:30]
    analysis.material = (result.get("material") or None) and str(result["material"])[:200]
    analysis.processing_requirements = result.get("processing_requirements") or []
    analysis.governing_specs = result.get("governing_specs") or []
    analysis.masking_requirements = result.get("masking_requirements") or []
    analysis.post_treatment_requirements = result.get("post_treatment_requirements") or []
    analysis.dimensions = fixed_dimensions
    # prefer the deterministic sum of the (possibly-corrected) breakdown over the model's own
    # separately-stated total, since that sum is now guaranteed arithmetically consistent
    analysis.surface_area_sq_in = computed_total if computed_total is not None else result.get("surface_area_sq_in")
    analysis.surface_area_method = result.get("surface_area_method")
    analysis.surface_area_confidence = result.get("surface_area_confidence")
    analysis.overall_thickness_in = result.get("overall_thickness_in")
    analysis.overall_thickness_source = result.get("overall_thickness_source")
    analysis.overall_thickness_confidence = result.get("overall_thickness_confidence")
    analysis.warnings = result.get("warnings") or []
    analysis.raw_result = result
    db.flush()

    audit_service.record(
        db, actor=actor, action="drawing_analysis", entity_type="drawing_analysis",
        entity_id=str(analysis.id),
        after={
            "filename": filename,
            "part_number": analysis.part_number,
            "surface_area_sq_in": analysis.surface_area_sq_in,
            "processes": [p.get("process") for p in analysis.processing_requirements],
        },
    )
    return analysis


def list_analyses(db: Session) -> list[DrawingAnalysis]:
    return db.execute(select(DrawingAnalysis).order_by(DrawingAnalysis.created_at.desc())).scalars().all()
