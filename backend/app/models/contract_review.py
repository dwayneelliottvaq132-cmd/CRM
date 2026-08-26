import datetime as dt

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class ContractReview(Base):
    """The retained AS9100 §8.2.3 review-of-requirements record for an order — a documented
    confirmation, before committing to supply, that the spec/revision, customer special
    requirements, statutory/regulatory (incl. ITAR) requirements, and the shop's own
    capability (an approved process/plan, capacity) are all understood and can be met.

    One per order (order_id unique). An order for a customer flagged requires_contract_review
    cannot become a work order until this review's outcome is 'Accepted'."""

    __tablename__ = "contract_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), unique=True)

    # §8.2.3.1 checklist — all must be true before the review can be Accepted
    customer_requirements_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    spec_and_revision_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    special_requirements_understood: Mapped[bool] = mapped_column(Boolean, default=False)
    regulatory_itar_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_process_available: Mapped[bool] = mapped_column(Boolean, default=False)
    capacity_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    differences_resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    governing_spec: Mapped[str] = mapped_column(String(120), default="")
    spec_revision: Mapped[str] = mapped_column(String(30), default="")
    # special requirements considered, seeded from the linked PO when PO-sourced: [str]
    captured_requirements: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    outcome: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending | Accepted | Rejected
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    order = relationship("Order", back_populates="contract_review")

    CHECKLIST_FIELDS = (
        "customer_requirements_reviewed",
        "spec_and_revision_confirmed",
        "special_requirements_understood",
        "regulatory_itar_reviewed",
        "approved_process_available",
        "capacity_confirmed",
        "differences_resolved",
    )

    def all_checked(self) -> bool:
        return all(getattr(self, f) for f in self.CHECKLIST_FIELDS)
