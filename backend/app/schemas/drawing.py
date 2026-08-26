import datetime as dt

from app.schemas.common import ORMModel


class DrawingAnalysisOut(ORMModel):
    id: int
    filename: str
    file_size: int
    status: str
    part_number: str | None
    revision: str | None
    material: str | None
    processing_requirements: list | None
    governing_specs: list | None
    masking_requirements: list | None
    post_treatment_requirements: list | None
    dimensions: list | None
    surface_area_sq_in: float | None
    surface_area_method: str | None
    surface_area_confidence: str | None
    overall_thickness_in: float | None
    overall_thickness_source: str | None
    overall_thickness_confidence: str | None
    warnings: list | None
    error_detail: str | None
    model_used: str | None
    created_by: str
    created_at: dt.datetime
    stored_file_path: str | None


class DrawingBatchResultOut(ORMModel):
    """One entry per file submitted to /drawings/analyze-batch — a file can fail before any
    DrawingAnalysis row exists (e.g. not a PDF), so `analysis` is null in that case and the
    caller falls back to `error`."""

    filename: str
    success: bool
    analysis: DrawingAnalysisOut | None
    error: str | None


class DrawingAiStatus(ORMModel):
    configured: bool
    model: str
    detail: str


class GenerateRoutingPlanRequest(ORMModel):
    customer_id: int
    part_number: str | None = None
    revision: str | None = None
    spec: str | None = None
    attach_to_template_id: str | None = None
