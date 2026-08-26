import datetime as dt

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class InventoryLot(Base):
    """Lot-traced chemical consumable. Lot numbers trace to bath make-ups/additions
    so a Certificate can be traced back to the chemical lots in the tank at time of processing."""

    __tablename__ = "inventory_lots"

    id: Mapped[int] = mapped_column(primary_key=True)
    chemical_name: Mapped[str] = mapped_column(String(160))
    lot_number: Mapped[str] = mapped_column(String(40))  # unique per-chemical in the source system, not globally
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    on_hand_qty: Mapped[float] = mapped_column(Numeric(10, 2))
    on_hand_unit: Mapped[str] = mapped_column(String(20))  # gal, kg, cs...
    reorder_at_qty: Mapped[float] = mapped_column(Numeric(10, 2))
    expires_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    vendor = relationship("Vendor", back_populates="inventory_lots")

    def status(self, as_of: dt.date | None = None) -> str:
        as_of = as_of or dt.date.today()
        if self.expires_at and self.expires_at < as_of:
            return "Expired lot"
        if self.expires_at and (self.expires_at - as_of).days <= 45:
            return "Expiring"
        if float(self.on_hand_qty) <= float(self.reorder_at_qty):
            return "Reorder"
        return "OK"
