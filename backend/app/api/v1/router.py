from fastapi import APIRouter

from app.api.v1 import (
    attachments,
    audit,
    auth,
    certificates,
    chemistry,
    compliance,
    customers,
    dashboard,
    documents,
    drawings,
    email_intake,
    equipment,
    inventory,
    invoices,
    jobs,
    meta,
    oauth,
    orders,
    portal,
    purchase_orders,
    rates,
    quickbooks,
    routing,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(oauth.router)
api_router.include_router(dashboard.router)
api_router.include_router(customers.router)
api_router.include_router(users.router)
api_router.include_router(orders.router)
api_router.include_router(rates.router)
api_router.include_router(jobs.router)
api_router.include_router(routing.router)
api_router.include_router(chemistry.router)
api_router.include_router(compliance.router)
api_router.include_router(certificates.router)
api_router.include_router(invoices.router)
api_router.include_router(quickbooks.router)
api_router.include_router(equipment.router)
api_router.include_router(inventory.router)
api_router.include_router(documents.router)
api_router.include_router(drawings.router)
api_router.include_router(email_intake.router)
api_router.include_router(purchase_orders.router)
api_router.include_router(portal.router)
api_router.include_router(audit.router)
api_router.include_router(meta.router)
api_router.include_router(attachments.router)
