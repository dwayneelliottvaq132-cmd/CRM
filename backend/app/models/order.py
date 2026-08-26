import datetime as dt

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Order(Base):
    """Sales order or quote. Converting a quote creates a Job + traveler."""

    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # SO-26-0412 / QT-26-0188
    kind: Mapped[str] = mapped_column(String(10))  # order | quote
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    customer_po: Mapped[str] = mapped_column(String(60))
    part_number: Mapped[str] = mapped_column(String(60))
    spec: Mapped[str] = mapped_column(String(120))
    qty: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Numeric(12, 2))
    due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="Queued")  # Queued | Pending Contract Review | Converted | ...
    converted_job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    # links the scanned purchase order this sales order was generated from, kept for reference
    purchase_order_analysis_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_order_analyses.id"), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    customer = relationship("Customer", back_populates="orders")
    lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")
    contract_review = relationship("ContractReview", back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"))
    description: Mapped[str] = mapped_column(String(255))
    qty: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    # set when this line was created from a scanned PO line item (purchase_order_analysis_service);
    # null for lines created any other way. Lets a line be routed to a Job of its own.
    part_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    revision: Mapped[str | None] = mapped_column(String(10), nullable=True)
    spec: Mapped[str | None] = mapped_column(String(120), nullable=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)

    order = relationship("Order", back_populates="lines")
