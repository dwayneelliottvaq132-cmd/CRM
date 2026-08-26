import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

QB_SYNC_STATUSES = ("Not synced", "Pending", "Syncing", "Synced", "Error")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # INV-26-1042
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    terms: Mapped[str] = mapped_column(String(30))  # Net 30, Net 45
    status: Mapped[str] = mapped_column(String(20), default="Draft")  # Draft | Sent | Paid | Overdue
    qb_sync_status: Mapped[str] = mapped_column(String(20), default="Not synced")
    quickbooks_invoice_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    last_synced_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    customer = relationship("Customer", back_populates="invoices")
    lines: Mapped[list["InvoiceLine"]] = relationship(
        "InvoiceLine", back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"))
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    invoice = relationship("Invoice", back_populates="lines")
    job = relationship("Job")
