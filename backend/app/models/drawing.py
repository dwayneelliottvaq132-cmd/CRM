import datetime as dt

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class DrawingAnalysis(Base):
    """An AI scan of a customer PDF drawing: extracted processing requirements
    (finish/plating callouts, governing specs, masking) and an estimated part
    surface area — the two inputs quoting needs from every print.

    Results are advisory: a human reviews them before they drive a quote or a
    traveler. The full raw model output is kept for traceability."""

    __tablename__ = "drawing_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="Complete")  # Complete | Error

    # extracted title-block fields
    part_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    revision: Mapped[str | None] = mapped_column(String(30), nullable=True)
    material: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # what to do to the part: [{process, spec, class_type, notes}]
    processing_requirements: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    governing_specs: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [{spec, description}]
    masking_requirements: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [str]
    post_treatment_requirements: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [{treatment, spec, notes}]

    # geometry: [{feature, dimensions_text, shape, params, area_sq_in, computed}] — `computed`
    # is True when the app recomputed area_sq_in deterministically from shape+params rather
    # than trusting the model's own arithmetic (see drawing_analysis_service._recompute_dimensions)
    dimensions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    surface_area_sq_in: Mapped[float | None] = mapped_column(Float, nullable=True)
    surface_area_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    surface_area_confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # high|medium|low

    # the single dimension driving most of the surface-area estimate, called out separately
    # since misreading it has an outsized effect on the total (see PROMPT)
    overall_thickness_in: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_thickness_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    overall_thickness_confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # high|medium|low|n/a

    warnings: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [str]
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    model_used: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    # relative path under backend/data/ where the original uploaded PDF is stored
    # (e.g. "uploads/drawings/22.pdf"); null for pre-migration rows scanned before
    # file storage existed.
    stored_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
