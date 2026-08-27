from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.customer import Customer
from app.models.job import Job
from app.models.order import Order, OrderLine
from app.models.purchase_order import PurchaseOrderAnalysis
from app.models.routing import Part, RoutingRevision, RoutingTemplate
from app.models.user import User
from app.schemas.job import JobPlanningContextOut
from app.schemas.routing import (
    GenerateFromPoRequest,
    PartCreate,
    PartOut,
    PartUpdate,
    RoutingRevisionCreate,
    RoutingRevisionDetailOut,
    RoutingRevisionOut,
    RoutingTemplateCreate,
    RoutingTemplateOut,
    RoutingTemplateUpdate,
    StepsReplace,
)
from app.services import audit_service, routing_service
from app.services.exceptions import BusinessRuleError, NotFoundError

router = APIRouter(prefix="/routing", tags=["routing"], dependencies=[Depends(get_current_user)])


def _find_po_line_for_job(db: Session, job: Job) -> dict | None:
    """A job created from a scanned PO has no direct FK back to its originating line —
    only the OrderLine.job_id back-reference — so this looks up the order via the
    OrderLine, then the linked PurchaseOrderAnalysis, then matches by part_number+revision."""
    order_line = db.execute(select(OrderLine).where(OrderLine.job_id == job.id)).scalar_one_or_none()
    if order_line is None:
        return None
    order = db.get(Order, order_line.order_id)
    if order is None or order.purchase_order_analysis_id is None:
        return None
    po = db.get(PurchaseOrderAnalysis, order.purchase_order_analysis_id)
    if po is None:
        return None
    return next(
        (li for li in (po.line_items or []) if li.get("part_number") == job.part_number and li.get("revision") == job.revision),
        None,
    )


def _revision_query():
    return select(RoutingRevision).options(selectinload(RoutingRevision.steps))


# ---- routing templates -----------------------------------------------------------------


@router.get("/templates", response_model=list[RoutingTemplateOut])
def list_templates(include_inactive: bool = False, db: Session = Depends(get_db)) -> list[RoutingTemplate]:
    stmt = select(RoutingTemplate).order_by(RoutingTemplate.name)
    if not include_inactive:
        stmt = stmt.where(RoutingTemplate.active.is_(True))
    return db.execute(stmt).scalars().all()


@router.post("/templates", response_model=RoutingTemplateOut, status_code=201)
def create_template(body: RoutingTemplateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingTemplate:
    template = RoutingTemplate(id=routing_service.next_template_id(db), name=body.name, spec=body.spec)
    db.add(template)
    db.flush()
    audit_service.record(db, actor=user.name, action="create", entity_type="routing_template", entity_id=template.id, after=body.model_dump(mode="json"))
    db.commit()
    db.refresh(template)
    return template


@router.patch("/templates/{template_id}", response_model=RoutingTemplateOut)
def update_template(template_id: str, body: RoutingTemplateUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingTemplate:
    template = db.get(RoutingTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Routing template not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(template, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="routing_template", entity_id=template_id, after=changes)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
def archive_template(template_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    template = db.get(RoutingTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Routing template not found")
    template.active = False
    db.flush()
    audit_service.record(db, actor=user.name, action="archive", entity_type="routing_template", entity_id=template_id, after={"active": False})
    db.commit()


@router.get("/templates/{template_id}/revisions", response_model=list[RoutingRevisionOut])
def list_template_revisions(template_id: str, db: Session = Depends(get_db)) -> list[RoutingRevision]:
    if db.get(RoutingTemplate, template_id) is None:
        raise HTTPException(404, "Routing template not found")
    return db.execute(select(RoutingRevision).where(RoutingRevision.routing_template_id == template_id).order_by(RoutingRevision.revision_number)).scalars().all()


@router.post("/templates/{template_id}/revisions", response_model=RoutingRevisionDetailOut, status_code=201)
def create_template_revision(template_id: str, body: RoutingRevisionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingRevision:
    if db.get(RoutingTemplate, template_id) is None:
        raise HTTPException(404, "Routing template not found")
    try:
        revision = routing_service.create_draft_revision(
            db,
            routing_template_id=template_id,
            actor=user.name,
            cloned_from_revision_id=body.clone_from_revision_id,
            steps=[s.model_dump() for s in body.steps] if body.steps is not None else None,
        )
        db.commit()
    except (BusinessRuleError, NotFoundError) as exc:
        db.rollback()
        raise HTTPException(409 if isinstance(exc, BusinessRuleError) else 404, str(exc)) from exc
    return db.execute(_revision_query().where(RoutingRevision.id == revision.id)).scalar_one()


# ---- parts -----------------------------------------------------------------------------


@router.get("/parts", response_model=list[PartOut])
def list_parts(include_inactive: bool = False, db: Session = Depends(get_db)) -> list[Part]:
    stmt = select(Part).order_by(Part.part_number)
    if not include_inactive:
        stmt = stmt.where(Part.active.is_(True))
    return db.execute(stmt).scalars().all()


@router.post("/parts", response_model=PartOut, status_code=201)
def create_part(body: PartCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Part:
    if db.get(Customer, body.customer_id) is None:
        raise HTTPException(404, "Customer not found")
    existing = db.execute(
        select(Part).where(Part.customer_id == body.customer_id, Part.part_number == body.part_number, Part.revision == body.revision)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Part {body.part_number} rev {body.revision} already exists for this customer")
    part = Part(**body.model_dump())
    db.add(part)
    db.flush()
    audit_service.record(db, actor=user.name, action="create", entity_type="part", entity_id=str(part.id), after=body.model_dump(mode="json"))
    db.commit()
    db.refresh(part)
    return part


@router.patch("/parts/{part_id}", response_model=PartOut)
def update_part(part_id: int, body: PartUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Part:
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(404, "Part not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(part, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="part", entity_id=str(part_id), after=changes)
    db.commit()
    db.refresh(part)
    return part


@router.delete("/parts/{part_id}", status_code=204)
def archive_part(part_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(404, "Part not found")
    part.active = False
    db.flush()
    audit_service.record(db, actor=user.name, action="archive", entity_type="part", entity_id=str(part_id), after={"active": False})
    db.commit()


@router.get("/parts/{part_id}/revisions", response_model=list[RoutingRevisionOut])
def list_part_revisions(part_id: int, db: Session = Depends(get_db)) -> list[RoutingRevision]:
    if db.get(Part, part_id) is None:
        raise HTTPException(404, "Part not found")
    return db.execute(select(RoutingRevision).where(RoutingRevision.part_id == part_id).order_by(RoutingRevision.revision_number)).scalars().all()


@router.post("/parts/{part_id}/revisions", response_model=RoutingRevisionDetailOut, status_code=201)
def create_part_revision(part_id: int, body: RoutingRevisionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingRevision:
    if db.get(Part, part_id) is None:
        raise HTTPException(404, "Part not found")
    try:
        revision = routing_service.create_draft_revision(
            db,
            part_id=part_id,
            actor=user.name,
            cloned_from_revision_id=body.clone_from_revision_id,
            steps=[s.model_dump() for s in body.steps] if body.steps is not None else None,
        )
        db.commit()
    except (BusinessRuleError, NotFoundError) as exc:
        db.rollback()
        raise HTTPException(409 if isinstance(exc, BusinessRuleError) else 404, str(exc)) from exc
    return db.execute(_revision_query().where(RoutingRevision.id == revision.id)).scalar_one()


# ---- shared revision actions (owner-agnostic) -------------------------------------------


@router.get("/revisions/{revision_id}", response_model=RoutingRevisionDetailOut)
def get_revision(revision_id: int, db: Session = Depends(get_db)) -> RoutingRevision:
    revision = db.execute(_revision_query().where(RoutingRevision.id == revision_id)).scalar_one_or_none()
    if revision is None:
        raise HTTPException(404, "Routing revision not found")
    return revision


@router.put("/revisions/{revision_id}/steps", response_model=RoutingRevisionDetailOut)
def replace_revision_steps(revision_id: int, body: StepsReplace, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingRevision:
    try:
        routing_service.replace_steps(db, revision_id=revision_id, steps=[s.model_dump() for s in body.steps])
        db.commit()
    except (BusinessRuleError, NotFoundError) as exc:
        db.rollback()
        raise HTTPException(409 if isinstance(exc, BusinessRuleError) else 404, str(exc)) from exc
    return db.execute(_revision_query().where(RoutingRevision.id == revision_id)).scalar_one()


@router.post("/revisions/{revision_id}/release", response_model=RoutingRevisionDetailOut)
def release_revision(revision_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingRevision:
    try:
        routing_service.release_revision(db, revision_id=revision_id, actor=user.name)
        audit_service.record(db, actor=user.name, action="release", entity_type="routing_revision", entity_id=str(revision_id), after={"status": "Released"})
        db.commit()
    except (BusinessRuleError, NotFoundError) as exc:
        db.rollback()
        raise HTTPException(409 if isinstance(exc, BusinessRuleError) else 404, str(exc)) from exc
    return db.execute(_revision_query().where(RoutingRevision.id == revision_id)).scalar_one()


@router.post("/revisions/{revision_id}/obsolete", response_model=RoutingRevisionDetailOut)
def obsolete_revision(revision_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RoutingRevision:
    try:
        routing_service.obsolete_revision(db, revision_id=revision_id)
        audit_service.record(db, actor=user.name, action="obsolete", entity_type="routing_revision", entity_id=str(revision_id), after={"status": "Obsolete"})
        db.commit()
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    return db.execute(_revision_query().where(RoutingRevision.id == revision_id)).scalar_one()


# ---- Planning module: per-job context and drawing/PO-driven draft generation -----------


@router.get("/jobs/{job_id}/planning-context", response_model=JobPlanningContextOut)
def job_planning_context(job_id: str, db: Session = Depends(get_db)) -> dict:
    """Bundles everything the Planning module needs for one job: the job, its (possibly
    just-created) Part, matching templates for its linked drawing scan and/or PO line,
    the drawing scan itself, the originating PO line, and a spec_mismatch warning when
    the part already has a plan built for a different spec — the drawing and PO line
    are what "populate" the traveler-building step."""
    job = db.execute(select(Job).options(selectinload(Job.customer)).where(Job.id == job_id)).scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job not found")

    part = routing_service.get_or_create_part(
        db, customer_id=job.customer_id, part_number=job.part_number, revision=job.revision, spec=job.spec
    )
    db.commit()

    drawing = job.source_drawing_analysis
    po_line = _find_po_line_for_job(db, job)
    candidate_specs = routing_service.drawing_governing_specs(drawing) | routing_service.po_line_governing_specs(po_line)
    matching_templates = routing_service.find_matching_templates(db, specs=candidate_specs)
    mismatch = routing_service.spec_mismatch(db, part=part, incoming_specs=candidate_specs)

    return {
        "job": job, "part": part, "matching_templates": matching_templates,
        "drawing": drawing, "po_line": po_line, "spec_mismatch": mismatch,
    }


@router.post("/jobs/{job_id}/generate-from-po", response_model=RoutingRevisionDetailOut, status_code=201)
def generate_from_po(
    job_id: str, body: GenerateFromPoRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> RoutingRevision:
    """Planning module: 'Populate from PO Scan' — the PO-side counterpart to
    POST /drawings/{id}/generate-routing-plan. Builds a Draft plan on the job's Part
    from the originating PO line's structured processing_requirements. If
    attach_to_template_id is supplied, the plan is built by cloning that template's
    Released revision instead of building from scratch. Either way, if this job also
    has a linked drawing scan, that drawing's masking/post-treatment requirements are
    layered in — a job's masking requirements don't disappear just because the plan was
    populated from the PO button instead of the drawing button."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")

    po_line = _find_po_line_for_job(db, job)
    if po_line is None or not po_line.get("processing_requirements"):
        raise HTTPException(409, "No PO-scan processing requirements available for this job")

    part = routing_service.get_or_create_part(
        db, customer_id=job.customer_id, part_number=job.part_number, revision=job.revision, spec=job.spec
    )
    drawing = job.source_drawing_analysis

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
            masking=drawing.masking_requirements if drawing else None,
            post_treatment_requirements=drawing.post_treatment_requirements if drawing else None,
        )
        cloned_from_revision_id = template_released.id
    else:
        steps = routing_service.generate_steps_from_po_line(po_line, drawing=drawing)
        cloned_from_revision_id = None

    revision = routing_service.create_draft_revision(
        db, part_id=part.id, actor=user.name, cloned_from_revision_id=cloned_from_revision_id, steps=steps
    )
    audit_service.record(
        db, actor=user.name, action="generate_from_po", entity_type="routing_revision",
        entity_id=str(revision.id), after={"job_id": job_id, "part_id": part.id, "attach_to_template_id": body.attach_to_template_id},
    )
    db.commit()
    return db.execute(_revision_query().where(RoutingRevision.id == revision.id)).scalar_one()
