from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import get_settings

router = APIRouter(prefix="/meta", tags=["meta"], dependencies=[Depends(get_current_user)])
settings = get_settings()

ENDPOINTS = [
    {"method": "GET", "path": "/api/v1/jobs", "desc": "List / filter jobs"},
    {"method": "POST", "path": "/api/v1/orders/{id}/convert", "desc": "Create job from order"},
    {"method": "GET", "path": "/api/v1/jobs/{id}/traveler", "desc": "Ops + sign-off record"},
    {"method": "POST", "path": "/api/v1/jobs/{id}/ops/{seq}/signoff", "desc": "Operator sign-off"},
    {"method": "GET", "path": "/api/v1/tanks/{id}/analyses", "desc": "Solution analysis history"},
    {"method": "POST", "path": "/api/v1/tanks/{id}/analyses", "desc": "Log lab result (auto-hold)"},
    {"method": "GET", "path": "/api/v1/certs/{id}.pdf", "desc": "Signed C of C document"},
    {"method": "GET", "path": "/api/v1/ncrs", "desc": "NCR / CAPA records"},
    {"method": "POST", "path": "/api/v1/invoices/{id}/sync", "desc": "Push to QuickBooks"},
    {"method": "GET", "path": "/api/v1/audit-log", "desc": "Immutable change history"},
]


@router.get("/endpoints")
def endpoints() -> list[dict]:
    return ENDPOINTS


@router.get("/integration-info")
def integration_info() -> dict:
    return {
        "openapi_docs": "/docs",
        "openapi_schema": "/openapi.json",
        "auth": "OAuth2 client-credentials (POST /api/v1/oauth/token) or user login (POST /api/v1/auth/login)",
        "quickbooks_connected": settings.qbo_configured,
        "webhooks": ["job.status_changed", "ncr.opened", "invoice.paid"],
    }
