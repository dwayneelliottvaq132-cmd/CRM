from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services import email_intake_service

settings = get_settings()

scheduler = BackgroundScheduler()


def _poll_email_intake_job() -> None:
    db = SessionLocal()
    try:
        email_intake_service.poll_inbox(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.email_intake_configured:
        scheduler.add_job(
            _poll_email_intake_job,
            "interval",
            minutes=settings.imap_poll_interval_minutes,
            id="email_intake_poll",
        )
        scheduler.start()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    openapi_version="3.1.0",
    description="NADCAP / AS9100D paperless ERP for chemical processing — jobs, travelers, bath chemistry, "
    "compliance (NCR/CAPA), certs, invoicing (QuickBooks Online sync), calibration, inventory, vendors, "
    "document control, ITAR-aware customer portal.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
