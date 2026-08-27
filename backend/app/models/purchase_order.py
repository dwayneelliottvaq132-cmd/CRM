import datetime as dt

from sqlalchemy import Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class PurchaseOrderAnalysis(Base):
    """An AI scan of a customer purchase order PDF: extracted PO number/date, a best-guess
    customer name (a human still picks the real Customer before anything is created), PO-wide
    special requirements (C of C, source inspection, FAI, ...), and one entry per line item.

    Results are advisory: a human reviews them on the Purchase Orders review screen before
    anything is created in Orders/Travelers. The full raw model output is kept for
    traceability, same convention as DrawingAnalysis."""

    __tablename__ = "purchase_order_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="Complete")  # Complete | Error

    po_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    po_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    customer_name_guess: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # PO-wide notes that aren't tied to one line item: [str] — e.g. "Certificate of
    # Conformance required", "Source inspection required", "AS9102 FAI required"
    general_requirements: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # one entry per PO line: [{line_no, part_number, revision, description, qty, unit_price,
    # due_date, spec_text, drawing_ref_text, line_requirements: [str],
    # matched_drawing_analysis_id: int|None}] — matched_drawing_analysis_id is filled in
    # server-side after scanning attached drawings; a human can override it on review.
    line_items: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    warnings: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [str]
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    model_used: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    # relative path under backend/data/ where the original uploaded PDF is stored
    # (e.g. "uploads/purchase_orders/14.pdf"); null for pre-migration rows scanned
    # before file storage existed.
    stored_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
