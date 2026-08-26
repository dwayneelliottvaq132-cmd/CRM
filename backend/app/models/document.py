import datetime as dt

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Document(Base):
    """Controlled QMS document. Travelers link the revision current at job release;
    superseded revisions stay retrievable for audit but can't be issued to new jobs."""

    __tablename__ = "documents"

    doc_no: Mapped[str] = mapped_column(String(30), primary_key=True)  # WI-AN-014
    title: Mapped[str] = mapped_column(String(400))
    revision: Mapped[str] = mapped_column(String(5))
    effective_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    owner: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="Released")  # Released | In Review — Rev X
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)
