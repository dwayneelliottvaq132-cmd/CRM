import datetime as dt

from app.schemas.common import ORMModel


class EmailIntakeLogOut(ORMModel):
    id: int
    message_id: str
    sender: str
    subject: str
    attachment_filename: str | None
    status: str
    drawing_analysis_id: int | None
    error_detail: str | None
    processed_at: dt.datetime


class EmailIntakeStatus(ORMModel):
    configured: bool
    imap_host: str
    imap_folder: str
    allowed_senders: list[str]
    poll_interval_minutes: int
    last_poll_at: dt.datetime | None
    last_error: str | None
    last_error_at: dt.datetime | None
    detail: str
