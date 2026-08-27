from fastapi import APIRouter

from app.api.v1 import (
    attachments,
    audit,
    auth,
    certificates,
    chemistry,
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
    routing,
    users,
)

# Compliance and QuickBooks are hidden, not removed: app/api/v1/compliance.py and
# app/api/v1/quickbooks.py are untouched on disk, as are their models and services.
# Restoring either is re-adding its import above and its include_router call below.
# NOTE: the NCR *safety rails* are deliberately unaffected by this — an NCR hold still
# blocks sign-off and shipping (services/signoff_service.py, services/shipping_service.py).
# Only the screen is gone; the AS9100D control stays armed.
api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(oauth.router)
api_router.include_router(dashboard.router)
api_router.include_router(customers.router)
api_router.include_router(users.router)
api_router.include_router(orders.router)
api_router.include_router(jobs.router)
api_router.include_router(routing.router)
api_router.include_router(chemistry.router)
api_router.include_router(certificates.router)
api_router.include_router(invoices.router)
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
