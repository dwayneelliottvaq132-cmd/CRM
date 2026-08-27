import datetime as dt
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer
from app.models.drawing import DrawingAnalysis
from app.models.job import Job, JobOperation
from app.models.routing import Part, RoutingRevision, RoutingStep, RoutingTemplate
from app.services import id_service
from app.services.exceptions import BusinessRuleError, NotFoundError


@dataclass
class RoutingResolution:
    ops: list[JobOperation]
    source_routing_revision_id: int | None
    warning: str | None  # set only when the fallback default step was used


def get_or_create_part(db: Session, *, customer_id: int, part_number: str, revision: str, spec: str) -> Part:
    part = db.execute(
        select(Part).where(Part.customer_id == customer_id, Part.part_number == part_number, Part.revision == revision)
    ).scalar_one_or_none()
    if part is None:
        part = Part(customer_id=customer_id, part_number=part_number, revision=revision, spec=spec)
        db.add(part)
        db.flush()
    return part


def _lookup_released_plan(db: Session, *, customer: Customer, part_number: str, revision: str) -> tuple[Part | None, RoutingRevision | None]:
    part = db.execute(
        select(Part).where(
            Part.customer_id == customer.id, Part.part_number == part_number, Part.revision == revision, Part.active.is_(True)
        )
    ).scalar_one_or_none()
    plan = None
    if part:
        plan = db.execute(
            select(RoutingRevision)
            .options(selectinload(RoutingRevision.steps))
            .where(RoutingRevision.part_id == part.id, RoutingRevision.status == "Released")
        ).scalar_one_or_none()
    return part, plan


def resolve_routing_for_job(db: Session, *, customer: Customer, part_number: str, revision: str) -> RoutingResolution:
    """Look up the Part (customer, part_number, revision) and its current Released
    routing plan. Clones the plan's steps into unsaved JobOperation objects if found;
    otherwise falls back to a single default step, or blocks entirely if the customer
    requires an approved plan. Called from the Planning module's "Apply Released Plan" /
    "Proceed Without a Formal Plan" actions (via apply_released_plan_to_job /
    apply_placeholder_plan_to_job below), not automatically at job creation time."""
    _part, plan = _lookup_released_plan(db, customer=customer, part_number=part_number, revision=revision)

    if plan:
        ops = [
            JobOperation(
                seq=s.seq,
                name=s.name,
                parameters=s.parameters,
                work_instruction_doc_no=s.work_instruction_doc_no,
                tank_id=s.tank_id,
                equipment_id=s.equipment_id,
                is_final_inspect=s.is_final_inspect,
                required_parameters=s.required_parameters,
                source_routing_step_id=s.id,
            )
            for s in plan.steps
        ]
        return RoutingResolution(ops=ops, source_routing_revision_id=plan.id, warning=None)

    if customer.require_approved_routing:
        raise BusinessRuleError(
            f"No released routing plan exists for {customer.name} part {part_number} rev {revision} — "
            f"this customer requires an approved plan before a job can be created."
        )

    warning = f"No approved routing plan found for part {part_number} rev {revision} — job created with a default step only."
    return RoutingResolution(
        ops=[JobOperation(seq=10, name="Receive & Count", parameters="Visual 100%")],
        source_routing_revision_id=None,
        warning=warning,
    )


def apply_released_plan_to_job(db: Session, *, job: Job, actor: str) -> Job:
    """Planning-module action: 'Apply Released Plan'. Clones the part's current
    Released plan onto the job. Errors clearly if none exists — this button is only
    meant to be used when one does (the UI disables it otherwise); it deliberately does
    NOT fall back to a placeholder step, unlike resolve_routing_for_job's default-clone
    behavior, so the two Planning actions stay unambiguous (AS9100 §8.2.3 traceability:
    which outcome happened should always be explicit, never silently branched)."""
    if job.planning_status != "Needs Planning":
        raise BusinessRuleError(f"Job {job.id} planning is already complete.")
    if job.ops:
        raise BusinessRuleError(f"Job {job.id} already has operations — planning was already completed.")
    _part, plan = _lookup_released_plan(db, customer=job.customer, part_number=job.part_number, revision=job.revision)
    if plan is None:
        raise BusinessRuleError(
            f"No Released routing plan exists for part {job.part_number} rev {job.revision} — "
            f"release a plan first, or use 'Proceed Without a Formal Plan' if this customer allows it."
        )
    for s in plan.steps:
        db.add(JobOperation(
            job_id=job.id, seq=s.seq, name=s.name, parameters=s.parameters,
            work_instruction_doc_no=s.work_instruction_doc_no, tank_id=s.tank_id,
            equipment_id=s.equipment_id, is_final_inspect=s.is_final_inspect,
            required_parameters=s.required_parameters, source_routing_step_id=s.id,
        ))
    job.source_routing_revision_id = plan.id
    job.routing_warning = None
    job.planning_status = "Planned"
    db.flush()
    return job


def apply_placeholder_plan_to_job(db: Session, *, job: Job, actor: str) -> Job:
    """Planning-module action: 'Proceed Without a Formal Plan'. Creates the same
    single default step resolve_routing_for_job used to fall back to — but only when
    this customer doesn't require an approved plan; this is where that hard block now
    fires (moved here from order-conversion time)."""
    if job.planning_status != "Needs Planning":
        raise BusinessRuleError(f"Job {job.id} planning is already complete.")
    if job.ops:
        raise BusinessRuleError(f"Job {job.id} already has operations — planning was already completed.")
    if job.customer.require_approved_routing:
        raise BusinessRuleError(
            f"{job.customer.name} requires an approved routing plan before a job can proceed — "
            f"release a Released plan for part {job.part_number} rev {job.revision} first."
        )
    db.add(JobOperation(job_id=job.id, seq=10, name="Receive & Count", parameters="Visual 100%"))
    job.source_routing_revision_id = None
    job.routing_warning = (
        f"No approved routing plan found for part {job.part_number} rev {job.revision} — "
        f"job proceeded with a default step only."
    )
    job.planning_status = "Planned"
    db.flush()
    return job


def _owner_filter(routing_template_id: str | None, part_id: int | None):
    if bool(routing_template_id) == bool(part_id):
        raise BusinessRuleError("Exactly one of routing_template_id / part_id must be set.")
    if routing_template_id:
        return RoutingRevision.routing_template_id == routing_template_id
    return RoutingRevision.part_id == part_id


def next_revision_number(db: Session, *, routing_template_id: str | None = None, part_id: int | None = None) -> int:
    count = db.execute(
        select(RoutingRevision).where(_owner_filter(routing_template_id, part_id))
    ).scalars().all()
    return len(count) + 1


def create_draft_revision(
    db: Session,
    *,
    routing_template_id: str | None = None,
    part_id: int | None = None,
    actor: str,
    cloned_from_revision_id: int | None = None,
    source_drawing_analysis_id: int | None = None,
    steps: list[dict] | None = None,
) -> RoutingRevision:
    revision = RoutingRevision(
        routing_template_id=routing_template_id,
        part_id=part_id,
        revision_number=next_revision_number(db, routing_template_id=routing_template_id, part_id=part_id),
        status="Draft",
        cloned_from_revision_id=cloned_from_revision_id,
        source_drawing_analysis_id=source_drawing_analysis_id,
        created_by=actor,
    )
    db.add(revision)
    db.flush()

    source_steps: list[dict] = []
    if steps is not None:
        source_steps = steps
    elif cloned_from_revision_id is not None:
        source = db.execute(
            select(RoutingRevision).options(selectinload(RoutingRevision.steps)).where(RoutingRevision.id == cloned_from_revision_id)
        ).scalar_one_or_none()
        if source is None:
            raise NotFoundError(f"Routing revision {cloned_from_revision_id} not found")
        source_steps = [
            {
                "seq": s.seq,
                "name": s.name,
                "parameters": s.parameters,
                "work_instruction_doc_no": s.work_instruction_doc_no,
                "tank_id": s.tank_id,
                "equipment_id": s.equipment_id,
                "is_final_inspect": s.is_final_inspect,
                "required_parameters": s.required_parameters,
            }
            for s in source.steps
        ]

    _validate_required_parameters(source_steps)
    for step in source_steps:
        db.add(RoutingStep(routing_revision_id=revision.id, **step))
    db.flush()
    return revision


def _validate_required_parameters(steps: list[dict]) -> None:
    """Defense-in-depth check (the Pydantic schema layer already enforces this for
    API-originated requests) — required_parameters keys must be unique within a step."""
    for step in steps:
        params = step.get("required_parameters") or []
        keys = [p["key"] if isinstance(p, dict) else p.key for p in params]
        if len(keys) != len(set(keys)):
            raise BusinessRuleError(f"Duplicate required_parameters key in step '{step.get('name', '?')}'")


def replace_steps(db: Session, *, revision_id: int, steps: list[dict]) -> RoutingRevision:
    revision = db.get(RoutingRevision, revision_id)
    if revision is None:
        raise NotFoundError(f"Routing revision {revision_id} not found")
    if revision.status != "Draft":
        raise BusinessRuleError(f"Cannot edit steps on a {revision.status} revision — only Draft revisions are editable.")
    _validate_required_parameters(steps)
    for existing in list(revision.steps):
        db.delete(existing)
    db.flush()
    for step in steps:
        db.add(RoutingStep(routing_revision_id=revision_id, **step))
    db.flush()
    return revision


def release_revision(db: Session, *, revision_id: int, actor: str) -> RoutingRevision:
    revision = db.get(RoutingRevision, revision_id)
    if revision is None:
        raise NotFoundError(f"Routing revision {revision_id} not found")
    if revision.status != "Draft":
        raise BusinessRuleError(f"Only Draft revisions can be released (this one is {revision.status}).")
    if not revision.steps:
        raise BusinessRuleError("Cannot release a revision with no steps.")

    prior = db.execute(
        select(RoutingRevision).where(
            _owner_filter(revision.routing_template_id, revision.part_id), RoutingRevision.status == "Released"
        )
    ).scalar_one_or_none()
    now = dt.datetime.utcnow()
    if prior:
        prior.status = "Superseded"
        prior.superseded_at = now

    revision.status = "Released"
    revision.released_by = actor
    revision.released_at = now
    db.flush()
    return revision


def obsolete_revision(db: Session, *, revision_id: int) -> RoutingRevision:
    revision = db.get(RoutingRevision, revision_id)
    if revision is None:
        raise NotFoundError(f"Routing revision {revision_id} not found")
    revision.status = "Obsolete"
    db.flush()
    return revision


def next_template_id(db: Session) -> str:
    return id_service.next_id(db, RoutingTemplate, "RT-", 3)


def _assemble_steps_from_requirements(
    *,
    masking: list[str] | None,
    processing_requirements: list[dict] | None,
    post_treatment_requirements: list[dict] | None,
    final_parameters: str,
) -> list[dict]:
    """Shared step-assembly used by both generate_steps_from_drawing and
    generate_steps_from_po_line: Receive -> Mask -> Process(es) -> Post-Treatment(s) ->
    Final Inspect. Always a Draft starting point for human review — tank/equipment/
    work-instruction assignment is left blank, since neither a drawing nor a PO can
    tell you which physical asset to use."""
    steps: list[dict] = [{"seq": 10, "name": "Receive & Count", "parameters": "Visual 100%"}]
    seq = 20

    if masking:
        steps.append({"seq": seq, "name": "Mask per print", "parameters": "; ".join(masking)})
        seq += 10

    for req in processing_requirements or []:
        parameters = " · ".join(p for p in [req.get("spec"), req.get("class_type"), req.get("notes")] if p)
        steps.append({"seq": seq, "name": req.get("process") or "Process", "parameters": parameters})
        seq += 10

    for req in post_treatment_requirements or []:
        parameters = " · ".join(p for p in [req.get("spec"), req.get("notes")] if p)
        steps.append({"seq": seq, "name": req.get("treatment") or "Post-Treatment", "parameters": parameters})
        seq += 10

    steps.append({"seq": seq, "name": "Final Inspect", "parameters": final_parameters, "is_final_inspect": True})
    return steps


def generate_steps_from_drawing(drawing: DrawingAnalysis) -> list[dict]:
    """Rough out a step list from AI-extracted drawing data — see
    _assemble_steps_from_requirements for the shared assembly logic."""
    final_parameters = "Verify coating per governing spec"
    if drawing.surface_area_sq_in is not None:
        confidence = f" ({drawing.surface_area_confidence} confidence)" if drawing.surface_area_confidence else ""
        final_parameters += f" — est. {drawing.surface_area_sq_in:.1f} in²{confidence}"
    return _assemble_steps_from_requirements(
        masking=drawing.masking_requirements,
        processing_requirements=drawing.processing_requirements,
        post_treatment_requirements=drawing.post_treatment_requirements,
        final_parameters=final_parameters,
    )


def generate_steps_from_po_line(line_item: dict, *, drawing: DrawingAnalysis | None = None) -> list[dict]:
    """Rough out a step list from a scanned PO line's AI-extracted structured
    processing_requirements — same shape/caveats as generate_steps_from_drawing, always
    a Draft starting point for human review. PO lines don't carry structured masking or
    post-treatment breakdowns themselves, but when this job also has a linked drawing
    scan, that drawing's masking/post-treatment data is layered in here regardless of
    which scan actually triggered generation."""
    return _assemble_steps_from_requirements(
        masking=drawing.masking_requirements if drawing else None,
        processing_requirements=line_item.get("processing_requirements"),
        post_treatment_requirements=drawing.post_treatment_requirements if drawing else None,
        final_parameters="Verify per PO requirements and governing spec",
    )


def _spec_key(raw: str) -> str:
    """Normalize a spec string for matching: the identifier up to the first comma,
    uppercased, with a trailing revision letter stripped (e.g. 'MIL-DTL-5541F' and
    'MIL-DTL-5541, TYPE II, CLASS 3' both normalize to 'MIL-DTL-5541')."""
    base = raw.split(",")[0].strip().upper()
    return re.sub(r"(?<=\d)[A-Z]$", "", base)


def drawing_governing_specs(drawing: DrawingAnalysis | None) -> set[str]:
    """Raw (non-normalized) governing spec strings called out on a drawing scan."""
    if drawing is None:
        return set()
    return {g["spec"] for g in (drawing.governing_specs or []) if g.get("spec")}


def po_line_governing_specs(po_line: dict | None) -> set[str]:
    """Raw (non-normalized) governing spec strings called out on a scanned PO line —
    its own spec_text plus any spec named on its structured processing_requirements."""
    if po_line is None:
        return set()
    specs = {req["spec"] for req in (po_line.get("processing_requirements") or []) if req.get("spec")}
    if po_line.get("spec_text"):
        specs.add(po_line["spec_text"])
    return specs


def find_matching_templates(db: Session, *, specs: set[str]) -> list[RoutingTemplate]:
    """Active routing templates with a Released revision whose spec matches one of the
    given governing specs (normalized comparison — see _spec_key) — candidates to
    attach a generated plan to instead of building steps from scratch. `specs` is raw,
    un-normalized spec strings pulled from a drawing scan and/or a PO line (see
    drawing_governing_specs / po_line_governing_specs above); callers union both
    sources so a job gets template suggestions whichever scan(s) it has."""
    candidate_specs = {_spec_key(s) for s in specs if s}
    if not candidate_specs:
        return []
    templates = db.execute(
        select(RoutingTemplate)
        .join(RoutingRevision, RoutingRevision.routing_template_id == RoutingTemplate.id)
        .where(RoutingTemplate.active.is_(True), RoutingRevision.status == "Released")
    ).scalars().unique().all()
    return [t for t in templates if _spec_key(t.spec) in candidate_specs]


def spec_mismatch(db: Session, *, part: Part, incoming_specs: set[str]) -> str | None:
    """Flags when a part that already has at least one routing plan (Draft or
    Released) is being re-populated from a drawing/PO scan stating a different
    governing spec than the part's own spec field — e.g. the part was set up for
    'MIL-A-8625 Type II Class 1' but a new scan calls for 'MIL-DTL-5541 Type I Class
    1A'. Warning only — surfaced in the Planning module for a human to review, since a
    legitimate re-spec is possible (see api/v1/routing.py)."""
    if not incoming_specs:
        return None
    has_plan = db.execute(select(RoutingRevision.id).where(RoutingRevision.part_id == part.id).limit(1)).scalar_one_or_none()
    if has_plan is None:
        return None
    incoming_keys = {_spec_key(s) for s in incoming_specs}
    if _spec_key(part.spec) in incoming_keys:
        return None
    incoming_display = ", ".join(sorted(incoming_specs))
    return (
        f"Existing plan for {part.part_number} Rev {part.revision} was built for '{part.spec}' — "
        f"this scan calls for '{incoming_display}'. Review before applying."
    )


def attach_to_template(
    db: Session,
    *,
    template_revision_id: int,
    masking: list[str] | None,
    post_treatment_requirements: list[dict] | None,
) -> list[dict]:
    """Clone a Released template revision's steps, then layer masking/post-treatment
    augmentation on top: masking is inserted right after receiving, and post-treatment
    callouts (e.g. an embrittlement relief bake) are inserted right before the
    is_final_inspect step. Physical tank/equipment/work-instruction assignments already
    on the template's steps are kept as-is — only the new masking/post-treatment steps
    leave them blank for human review. `masking`/`post_treatment_requirements` come
    from whichever scan(s) a job has — a drawing scan, regardless of whether the plan
    itself was triggered from the drawing or from a PO scan."""
    template_rev = db.execute(
        select(RoutingRevision).options(selectinload(RoutingRevision.steps)).where(RoutingRevision.id == template_revision_id)
    ).scalar_one_or_none()
    if template_rev is None:
        raise NotFoundError(f"Routing revision {template_revision_id} not found")

    base_steps: list[dict] = [
        {
            "name": s.name,
            "parameters": s.parameters,
            "work_instruction_doc_no": s.work_instruction_doc_no,
            "tank_id": s.tank_id,
            "equipment_id": s.equipment_id,
            "is_final_inspect": s.is_final_inspect,
            "required_parameters": s.required_parameters,
        }
        for s in template_rev.steps
    ]

    if masking:
        masking_step = {
            "name": "Mask per print", "parameters": "; ".join(masking),
            "work_instruction_doc_no": None, "tank_id": None, "equipment_id": None, "is_final_inspect": False,
            "required_parameters": None,
        }
        insert_at = 1 if base_steps and base_steps[0]["name"] == "Receive & Count" else 0
        base_steps.insert(insert_at, masking_step)

    post_steps: list[dict] = []
    for req in post_treatment_requirements or []:
        parameters = " · ".join(p for p in [req.get("spec"), req.get("notes")] if p)
        post_steps.append({
            "name": req.get("treatment") or "Post-Treatment", "parameters": parameters,
            "work_instruction_doc_no": None, "tank_id": None, "equipment_id": None, "is_final_inspect": False,
            "required_parameters": None,
        })
    if post_steps:
        final_idx = next((i for i, s in enumerate(base_steps) if s["is_final_inspect"]), len(base_steps))
        base_steps[final_idx:final_idx] = post_steps

    for i, step in enumerate(base_steps):
        step["seq"] = (i + 1) * 10
    return base_steps
