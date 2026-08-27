import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.customer import Customer
from app.models.drawing import DrawingAnalysis
from app.models.routing import RoutingRevision, RoutingTemplate
from app.models.user import User
from app.schemas.drawing import DrawingAiStatus, DrawingAnalysisOut, DrawingBatchResultOut, GenerateRoutingPlanRequest
from app.schemas.routing import RoutingRevisionDetailOut, RoutingTemplateOut
from app.services import audit_service, drawing_analysis_service, routing_service, storage_service
from app.services.exceptions import BusinessRuleError

router = APIRouter(prefix="/drawings", tags=["drawings"], dependencies=[Depends(get_current_user)])


@router.get("/status", response_model=DrawingAiStatus)
def ai_status() -> dict:
    return drawing_analysis_service.status()


@router.get("", response_model=list[DrawingAnalysisOut])
def list_analyses(db: Session = Depends(get_db)) -> list[DrawingAnalysis]:
    return drawing_analysis_service.list_analyses(db)


@router.get("/{analysis_id}", response_model=DrawingAnalysisOut)
def get_analysis(analysis_id: int, db: Session = Depends(get_db)) -> DrawingAnalysis:
    analysis = db.get(DrawingAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(404, "Analysis not found")
    return analysis


@router.post("/analyze", response_model=DrawingAnalysisOut)
async def analyze_drawing(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DrawingAnalysis:
    """Scan a customer PDF drawing with Claude: extract processing requirements
    (finish callouts + governing specs + masking) and estimate surface area."""
    if not drawing_analysis_service.status()["configured"]:
        raise HTTPException(503, drawing_analysis_service.status()["detail"])
    data = await file.read()
    try:
        analysis = drawing_analysis_service.analyze_pdf(
            db, filename=file.filename or "drawing.pdf", data=data, actor=user.name
        )
        db.commit()
    except BusinessRuleError as exc:
        db.commit()  # keep the Error row + audit trail for traceability
        raise HTTPException(422, str(exc)) from exc
    return analysis


@router.post("/analyze-batch", response_model=list[DrawingBatchResultOut])
async def analyze_drawings_batch(
    files: list[UploadFile],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """Scan multiple PDF drawings from one upload — same analysis as /analyze per file, run
    sequentially so a bad file (wrong type, oversized, a transient AI failure) doesn't block
    the rest of the batch. Used by Quoting/Sales Orders when a customer email or RFQ packet
    bundles several prints together."""
    if not drawing_analysis_service.status()["configured"]:
        raise HTTPException(503, drawing_analysis_service.status()["detail"])
    if not files:
        raise HTTPException(422, "No files supplied")

    results: list[dict] = []
    for file in files:
        data = await file.read()
        try:
            analysis = drawing_analysis_service.analyze_pdf(
                db, filename=file.filename or "drawing.pdf", data=data, actor=user.name
            )
            db.commit()
            results.append({"filename": file.filename or "drawing.pdf", "success": True, "analysis": analysis, "error": None})
        except BusinessRuleError as exc:
            db.commit()  # keep any Error row analyze_pdf created for traceability
            results.append({"filename": file.filename or "drawing.pdf", "success": False, "analysis": None, "error": str(exc)})
    return results


@router.get("/{analysis_id}/file")
def download_drawing_file(analysis_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    analysis = db.get(DrawingAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(404, "Analysis not found")
    data = storage_service.load_pdf(analysis.stored_file_path)
    if data is None:
        raise HTTPException(404, "No stored file for this analysis")
    return StreamingResponse(
        io.BytesIO(data), media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{analysis.filename}"'},
    )


@router.get("/{analysis_id}/matching-templates", response_model=list[RoutingTemplateOut])
def matching_templates(analysis_id: int, db: Session = Depends(get_db)) -> list[RoutingTemplate]:
    """Active routing templates with a Released revision whose spec matches one of this
    drawing's governing specs — candidates to attach the generated plan to instead of
    building steps from scratch."""
    drawing = db.get(DrawingAnalysis, analysis_id)
    if drawing is None:
        raise HTTPException(404, "Drawing analysis not found")
    return routing_service.find_matching_templates(db, specs=routing_service.drawing_governing_specs(drawing))


@router.post("/{analysis_id}/generate-routing-plan", response_model=RoutingRevisionDetailOut, status_code=201)
def generate_routing_plan(
    analysis_id: int,
    body: GenerateRoutingPlanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RoutingRevision:
    """Turn a completed drawing scan into a Draft routing plan on the matching Part —
    always advisory: the caller must review and explicitly Release it, same as every
    other routing revision. Resolves or creates the Part from (customer, part_number,
    revision); tank/equipment/work-instruction assignment is left blank on every
    generated step since a drawing can't tell you which physical asset to use.

    If attach_to_template_id is supplied, the plan is built by cloning that template's
    Released revision and layering the drawing's masking/post-treatment requirements on
    top of it, instead of building the step list from scratch."""
    drawing = db.get(DrawingAnalysis, analysis_id)
    if drawing is None:
        raise HTTPException(404, "Drawing analysis not found")
    if drawing.status != "Complete":
        raise HTTPException(409, f"Cannot generate a plan from a {drawing.status.lower()} analysis")

    if db.get(Customer, body.customer_id) is None:
        raise HTTPException(404, "Customer not found")

    part_number = body.part_number or drawing.part_number
    revision = body.revision or drawing.revision
    if not part_number or not revision:
        raise HTTPException(422, "Part number and revision are required — the drawing scan didn't extract one, supply it in the request.")
    spec = body.spec or (drawing.governing_specs[0]["spec"] if drawing.governing_specs else None)
    if not spec:
        raise HTTPException(422, "Spec is required — the drawing scan didn't extract one, supply it in the request.")

    part = routing_service.get_or_create_part(db, customer_id=body.customer_id, part_number=part_number, revision=revision, spec=spec)

    if body.attach_to_template_id:
        template = db.get(RoutingTemplate, body.attach_to_template_id)
        if template is None:
            raise HTTPException(404, "Routing template not found")
        template_released = db.execute(
            select(RoutingRevision).where(
                RoutingRevision.routing_template_id == template.id, RoutingRevision.status == "Released"
            )
        ).scalar_one_or_none()
        if template_released is None:
            raise HTTPException(409, f"Template {template.id} has no Released revision to attach to")
        steps = routing_service.attach_to_template(
            db,
            template_revision_id=template_released.id,
            masking=drawing.masking_requirements,
            post_treatment_requirements=drawing.post_treatment_requirements,
        )
        cloned_from_revision_id = template_released.id
    else:
        steps = routing_service.generate_steps_from_drawing(drawing)
        cloned_from_revision_id = None

    revision_row = routing_service.create_draft_revision(
        db,
        part_id=part.id,
        actor=user.name,
        source_drawing_analysis_id=drawing.id,
        cloned_from_revision_id=cloned_from_revision_id,
        steps=steps,
    )
    audit_service.record(
        db, actor=user.name, action="generate_from_drawing", entity_type="routing_revision",
        entity_id=str(revision_row.id),
        after={"drawing_analysis_id": drawing.id, "part_id": part.id, "attach_to_template_id": body.attach_to_template_id},
    )
    db.commit()
    return db.execute(
        select(RoutingRevision).options(selectinload(RoutingRevision.steps)).where(RoutingRevision.id == revision_row.id)
    ).scalar_one()
