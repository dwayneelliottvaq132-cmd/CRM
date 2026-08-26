import datetime as dt

from app.schemas.common import ORMModel
from app.schemas.customer import VendorOut


class InventoryLotOut(ORMModel):
    id: int
    chemical_name: str
    lot_number: str
    vendor: VendorOut | None
    on_hand_qty: float
    on_hand_unit: str
    reorder_at_qty: float
    expires_at: dt.date | None


class InventoryLotCreate(ORMModel):
    chemical_name: str
    lot_number: str
    vendor_id: int
    on_hand_qty: float
    on_hand_unit: str
    reorder_at_qty: float
    expires_at: dt.date | None = None


class InventoryAdjust(ORMModel):
    on_hand_qty: float


class InventoryLotUpdate(ORMModel):
    chemical_name: str | None = None
    lot_number: str | None = None
    vendor_id: int | None = None
    on_hand_qty: float | None = None
    on_hand_unit: str | None = None
    reorder_at_qty: float | None = None
    expires_at: dt.date | None = None
