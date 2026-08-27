import datetime as dt

from sqlalchemy import Boolean, Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    quickbooks_customer_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    itar_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    require_approved_routing: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Gate trigger: orders for this customer require a completed+accepted Contract Review
    # (AS9100 §8.2.3) before they can become work orders. quality_standards is free text of
    # the standard(s) they hold us to (e.g. "AS9100D, NADCAP AC7108"), shown on the review.
    requires_contract_review: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    quality_standards: Mapped[str] = mapped_column(String(200), default="", server_default="")
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    portal_users = relationship("PortalUser", back_populates="customer")
    orders = relationship("Order", back_populates="customer")
    jobs = relationship("Job", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    category: Mapped[str] = mapped_column(String(120))
    approval_basis: Mapped[str] = mapped_column(String(200))
    otd_pct: Mapped[float] = mapped_column(Numeric(5, 1))
    survey_due_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    survey_overdue: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="Approved")  # Approved | Conditional | Suspended
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    inventory_lots = relationship("InventoryLot", back_populates="vendor")
