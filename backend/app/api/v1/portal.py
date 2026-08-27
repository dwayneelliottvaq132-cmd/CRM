import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_portal_user, get_db
from app.core.security import create_access_token, verify_secret
from app.models.certificate import Certificate
from app.models.job import Job
from app.models.user import PortalUser
from app.schemas.auth import Token
from app.schemas.portal import PortalJob, PortalLoginRequest

router = APIRouter(prefix="/portal", tags=["portal"])

JOB_STAGE_LABEL = {
    "Queued": "Queued",
    "In Process": "In process",
    "Final Inspect": "In process — Final inspection",
    "Hold — NCR": "On hold",
    "Complete": "Complete",
}


@router.post("/login", response_model=Token)
def portal_login(body: PortalLoginRequest, db: Session = Depends(get_db)) -> Token:
    portal_user = db.execute(select(PortalUser).where(PortalUser.email == body.email)).scalar_one_or_none()
    if portal_user is None or not portal_user.password_hash or not verify_secret(body.password, portal_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    token = create_access_token(subject=str(portal_user.id), extra_claims={"scope": "portal"})
    return Token(access_token=token)


def compute_portal_jobs(db: Session, customer_id: int) -> list[PortalJob]:
    """Customers see only their own jobs — no spec, ITAR flag, or process parameters exposed."""
    jobs = db.execute(
        select(Job).options(selectinload(Job.ops), selectinload(Job.certificates))
        .where(Job.customer_id == customer_id)
    ).scalars().all()

    out: list[PortalJob] = []
    for job in jobs:
        done = sum(1 for o in job.ops if o.done)
        pct = int(100 * done / len(job.ops)) if job.ops else 0
        cert = next((c for c in job.certificates if c.issued), None)
        stage = JOB_STAGE_LABEL.get(job.status, job.status)
        if job.status == "Complete":
            eta = "Delivered"
        elif job.due_date:
            eta = f"ETA {job.due_date.strftime('%b %-d')}"
        else:
            eta = "—"
        out.append(PortalJob(
            po=job.customer_po, part_number=job.part_number, stage=stage, eta=eta,
            pct=pct, has_cert=cert is not None, cert_id=cert.id if cert else None,
        ))
    return out


@router.get("/jobs", response_model=list[PortalJob])
def my_jobs(db: Session = Depends(get_db), portal_user: PortalUser = Depends(get_current_portal_user)) -> list[PortalJob]:
    return compute_portal_jobs(db, portal_user.customer_id)
