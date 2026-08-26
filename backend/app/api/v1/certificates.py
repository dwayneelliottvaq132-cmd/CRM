import datetime as dt
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.models.certificate import Certificate
from app.models.job import Job
from app.models.user import User
from app.schemas.certificate import CertificateOut, CertQueueItem
from app.services import cert_service
from app.services.exceptions import BusinessRuleError, NotFoundError

router = APIRouter(prefix="/certs", tags=["certificates"], dependencies=[Depends(get_current_user)])
settings = get_settings()


@router.get("/queue", response_model=list[CertQueueItem])
def cert_queue(db: Session = Depends(get_db)) -> list[CertQueueItem]:
    jobs = db.execute(
        select(Job).options(selectinload(Job.customer), selectinload(Job.ops), selectinload(Job.certificates))
        .where(Job.status.in_(["In Process", "Final Inspect", "Hold — NCR", "Complete"]))
    ).scalars().all()

    items: list[CertQueueItem] = []
    for job in jobs:
        issued_cert = next((c for c in job.certificates if c.issued), None)
        if issued_cert:
            items.append(CertQueueItem(
                job_id=job.id, customer_name=job.customer.name, process_label=job.process_label,
                ready=False, state=f"Issued {issued_cert.issued_at.strftime('%b %-d') if issued_cert.issued_at else ''}",
                certificate_id=issued_cert.id,
            ))
            continue
        ready, reason = cert_service.readiness(job)
        items.append(CertQueueItem(
            job_id=job.id, customer_name=job.customer.name, process_label=job.process_label,
            ready=ready, state=reason, certificate_id=None,
        ))
    return items


@router.post("/{job_id}/issue", response_model=CertificateOut)
def issue_certificate(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Certificate:
    year = dt.date.today().strftime("%y")
    seq = db.execute(select(func.count()).select_from(Certificate)).scalar_one() + 1
    cert_id = f"CERT-{year}-{seq:04d}"
    try:
        cert = cert_service.issue(db, job_id=job_id, cert_id=cert_id, actor=user.name)
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except NotFoundError as exc:
        db.rollback()
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    db.refresh(cert)
    return cert


@router.get("/{cert_id}.pdf")
def certificate_pdf(cert_id: str, db: Session = Depends(get_db)) -> StreamingResponse:
    cert = db.execute(select(Certificate).options(selectinload(Certificate.job).selectinload(Job.customer)).where(Certificate.id == cert_id)).scalar_one_or_none()
    if cert is None or not cert.issued:
        raise HTTPException(404, "Certificate not found or not yet issued")

    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    y = height - inch

    c.setFont("Helvetica-Bold", 16)
    c.drawString(inch, y, settings.company_name)
    c.setFont("Helvetica", 10)
    y -= 16
    c.drawString(inch, y, "Certificate of Conformance")
    c.setFont("Helvetica", 10)
    c.drawRightString(width - inch, y + 16, cert.id)
    c.drawRightString(width - inch, y, cert.issued_at.strftime("%d %b %Y") if cert.issued_at else "")
    y -= 30
    c.line(inch, y, width - inch, y)
    y -= 24

    job = cert.job
    # Prefer the immutable snapshot frozen at issue time; fall back to live job fields only
    # for legacy certs issued before the snapshot columns existed.
    part_number = cert.part_number or job.part_number
    revision = cert.revision or job.revision
    spec = cert.spec or job.spec
    rows = [
        ("Customer:", job.customer.name),
        ("PO:", job.customer_po),
        ("Part:", f"{part_number} Rev {revision}"),
        ("Spec:", spec),
        ("Material Lot:", cert.material_lot or job.material_lot or "—"),
        ("Qty Accepted:", f"{cert.qty_accepted} / {job.qty}"),
        ("Process:", cert.process_text),
        ("Routing:", cert.routing_revision_label or job.source_routing_revision_label or "—"),
        ("Job:", job.id),
    ]
    c.setFont("Helvetica", 11)
    for label, value in rows:
        c.drawString(inch, y, f"{label} {value}")
        y -= 18

    readings = cert.recorded_readings or []
    if readings:
        y -= 8
        c.setFont("Helvetica-Bold", 10)
        c.drawString(inch, y, "Recorded Process Data")
        y -= 15
        c.setFont("Helvetica", 9)
        for r in readings:
            unit = f" {r.get('unit')}" if r.get("unit") else ""
            status = "IN SPEC" if r.get("in_spec") is True else "OUT OF SPEC" if r.get("in_spec") is False else "recorded"
            c.drawString(inch, y, f"Op {r.get('op_seq')} {r.get('op_name')} — {r.get('label')}: {r.get('value')}{unit}  [{status}]")
            y -= 13

    y -= 10
    c.setFont("Helvetica", 9)
    text = (
        "Certification: The parts listed above were processed in accordance with the specification(s) and "
        "revision(s) noted. Process solutions were within control limits during processing (analysis records "
        "on file). Records are retained per AS9100D §7.5 and are available for review."
    )
    from textwrap import wrap

    for line in wrap(text, 95):
        c.drawString(inch, y, line)
        y -= 13

    y -= 30
    c.setFont("Helvetica", 11)
    c.drawString(inch, y, cert.issued_by or "")
    c.line(inch, y - 4, inch + 2.2 * inch, y - 4)
    y -= 16
    c.setFont("Helvetica", 8)
    c.drawString(inch, y, f"Quality Manager · e-signed {cert.issued_at.strftime('%d %b %Y %H:%M') if cert.issued_at else ''}")

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{cert.id}.pdf"'})


# Declared AFTER /{cert_id}.pdf so the literal ".pdf" route isn't shadowed — Starlette matches
# in declaration order and a bare /{cert_id} would otherwise capture "CERT-26-0002.pdf" whole.
@router.get("/{cert_id}", response_model=CertificateOut)
def get_certificate(cert_id: str, db: Session = Depends(get_db)) -> Certificate:
    cert = db.get(Certificate, cert_id)
    if cert is None:
        raise HTTPException(404, "Certificate not found")
    return cert
