from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentOut, DocumentUpdate
from app.services import audit_service

router = APIRouter(prefix="/documents", tags=["documents"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)) -> list[Document]:
    return db.execute(select(Document).order_by(Document.doc_no)).scalars().all()


@router.post("", response_model=DocumentOut, status_code=201)
def create_document(body: DocumentCreate, db: Session = Depends(get_db)) -> Document:
    if db.get(Document, body.doc_no):
        raise HTTPException(409, f"Document {body.doc_no} already exists")
    doc = Document(**body.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.patch("/{doc_no}", response_model=DocumentOut)
def update_document(doc_no: str, body: DocumentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Document:
    doc = db.get(Document, doc_no)
    if doc is None:
        raise HTTPException(404, "Document not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(doc, field, value)
    db.flush()
    audit_service.record(db, actor=user.name, action="update", entity_type="document", entity_id=doc_no, after=changes)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_no}", status_code=204)
def obsolete_document(doc_no: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Superseded/obsoleted documents stay retrievable for audit (AS9100D document
    control) — this sets status to Obsolete rather than deleting the row."""
    doc = db.get(Document, doc_no)
    if doc is None:
        raise HTTPException(404, "Document not found")
    doc.status = "Obsolete"
    db.flush()
    audit_service.record(db, actor=user.name, action="obsolete", entity_type="document", entity_id=doc_no, after={"status": "Obsolete"})
    db.commit()
