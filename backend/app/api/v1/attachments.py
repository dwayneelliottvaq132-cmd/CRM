import io
import pathlib

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.attachment import Attachment
from app.models.routing import Part, RoutingStep
from app.models.user import User
from app.schemas.attachment import AttachmentOut
from app.services import audit_service, storage_service

router = APIRouter(prefix="/attachments", tags=["attachments"], dependencies=[Depends(get_current_user)])

ENTITY_TYPES = {"part": Part, "routing_step": RoutingStep}
MAX_ATTACHMENT_BYTES = 200 * 1024 * 1024  # generous headroom for a short instructional video


def _validate_entity(db: Session, entity_type: str, entity_id: str) -> None:
    model = ENTITY_TYPES.get(entity_type)
    if model is None:
        raise HTTPException(422, f"Unknown entity_type '{entity_type}' — expected one of {sorted(ENTITY_TYPES)}")
    try:
        pk = int(entity_id)
    except ValueError:
        raise HTTPException(422, f"entity_id must be numeric for entity_type '{entity_type}'") from None
    if db.get(model, pk) is None:
        raise HTTPException(404, f"{entity_type} {entity_id} not found")


@router.get("", response_model=list[AttachmentOut])
def list_attachments(entity_type: str, entity_id: str, db: Session = Depends(get_db)) -> list[Attachment]:
    return db.execute(
        select(Attachment)
        .where(Attachment.entity_type == entity_type, Attachment.entity_id == entity_id)
        .order_by(Attachment.created_at)
    ).scalars().all()


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    label: str = Form(""),
    is_quality_alert: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Attachment:
    """A reference photo/video for a Part or a RoutingStep — process instruction or
    quality alert, shown to planners authoring the plan and operators executing it."""
    _validate_entity(db, entity_type, entity_id)

    content_type = file.content_type or ""
    if content_type.startswith("image/"):
        kind = "image"
    elif content_type.startswith("video/"):
        kind = "video"
    else:
        raise HTTPException(422, f"Unsupported file type '{content_type}' — only images and videos are accepted")

    data = await file.read()
    if len(data) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(413, f"File too large — max {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB")

    attachment = Attachment(
        entity_type=entity_type, entity_id=entity_id, kind=kind, label=label, is_quality_alert=is_quality_alert,
        filename=file.filename or "upload", content_type=content_type, file_size=len(data),
        stored_file_path="", uploaded_by=user.name,
    )
    db.add(attachment)
    db.flush()
    ext = pathlib.Path(file.filename or "").suffix or (".jpg" if kind == "image" else ".mp4")
    attachment.stored_file_path = storage_service.save_file("attachments", str(attachment.id), ext, data)
    audit_service.record(
        db, actor=user.name, action="create", entity_type="attachment", entity_id=str(attachment.id),
        after={"entity_type": entity_type, "entity_id": entity_id, "kind": kind, "is_quality_alert": is_quality_alert},
    )
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/{attachment_id}/file")
def get_attachment_file(attachment_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(404, "Attachment not found")
    data = storage_service.load_file(attachment.stored_file_path)
    if data is None:
        raise HTTPException(404, "No stored file for this attachment")
    return StreamingResponse(
        io.BytesIO(data), media_type=attachment.content_type,
        headers={"Content-Disposition": f'inline; filename="{attachment.filename}"'},
    )


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(404, "Attachment not found")
    audit_service.record(
        db, actor=user.name, action="delete", entity_type="attachment", entity_id=str(attachment_id),
        after={"entity_type": attachment.entity_type, "entity_id": attachment.entity_id},
    )
    storage_service.delete_file(attachment.stored_file_path)
    db.delete(attachment)
    db.commit()
