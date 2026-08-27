from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.customer import Customer, Vendor
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate, VendorCreate, VendorOut, VendorUpdate
from app.schemas.portal import PortalJob
from app.services import audit_service

router = APIRouter(tags=["customers"], dependencies=[Depends(get_current_user)])


@router.get("/customers", response_model=list[CustomerOut])
def list_customers(include_inactive: bool = False, db: Session = Depends(get_db)) -> list[Customer]:
    stmt = select(Customer).order_by(Customer.name)
    if not include_inactive:
        stmt = stmt.where(Customer.active.is_(True))
    return db.execute(stmt).scalars().all()


@router.post("/customers", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerCreate, db: Session = Depends(get_db)) -> Customer:
    if db.execute(select(Customer).where(Customer.name == body.name)).scalar_one_or_none():
        raise HTTPException(409, f"Customer '{body.name}' already exists")
    customer = Customer(**body.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, body: CustomerUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(customer, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="customer", entity_id=str(customer_id), after=changes)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}", status_code=204)
def archive_customer(customer_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Soft delete — a customer stays referenced by historical orders/jobs/invoices,
    so it's archived (hidden from active lists) rather than removed."""
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    customer.active = False
    db.flush()
    audit_service.record(db, actor=user.name, action="archive", entity_type="customer", entity_id=str(customer_id), after={"active": False})
    db.commit()


@router.get("/customers/{customer_id}/portal-preview", response_model=list[PortalJob])
def portal_preview(customer_id: int, db: Session = Depends(get_db)) -> list[PortalJob]:
    """Internal preview of what this customer sees in the Customer Portal — used by the
    ERP's own Portal screen so QA/CS can check the external view without a separate login."""
    from app.api.v1.portal import compute_portal_jobs

    if db.get(Customer, customer_id) is None:
        raise HTTPException(404, "Customer not found")
    return compute_portal_jobs(db, customer_id)


@router.get("/vendors", response_model=list[VendorOut])
def list_vendors(include_inactive: bool = False, db: Session = Depends(get_db)) -> list[Vendor]:
    stmt = select(Vendor).order_by(Vendor.name)
    if not include_inactive:
        stmt = stmt.where(Vendor.active.is_(True))
    return db.execute(stmt).scalars().all()


@router.post("/vendors", response_model=VendorOut, status_code=201)
def create_vendor(body: VendorCreate, db: Session = Depends(get_db)) -> Vendor:
    vendor = Vendor(**body.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.patch("/vendors/{vendor_id}", response_model=VendorOut)
def update_vendor(vendor_id: int, body: VendorUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Vendor:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(404, "Vendor not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(vendor, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="vendor", entity_id=str(vendor_id), after=changes)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.delete("/vendors/{vendor_id}", status_code=204)
def archive_vendor(vendor_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Soft delete — inventory lots may still reference this vendor historically."""
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(404, "Vendor not found")
    vendor.active = False
    db.flush()
    audit_service.record(db, actor=user.name, action="archive", entity_type="vendor", entity_id=str(vendor_id), after={"active": False})
    db.commit()
