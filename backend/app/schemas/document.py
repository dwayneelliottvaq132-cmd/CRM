import datetime as dt

from app.schemas.common import ORMModel


class DocumentOut(ORMModel):
    doc_no: str
    title: str
    revision: str
    effective_date: dt.date | None
    owner: str
    status: str


class DocumentCreate(ORMModel):
    doc_no: str
    title: str
    revision: str
    effective_date: dt.date | None = None
    owner: str
    status: str = "Released"


class DocumentUpdate(ORMModel):
    title: str | None = None
    revision: str | None = None
    effective_date: dt.date | None = None
    owner: str | None = None
    status: str | None = None
