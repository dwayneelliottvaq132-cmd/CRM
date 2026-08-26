import datetime as dt

from app.schemas.common import ORMModel


class AttachmentOut(ORMModel):
    id: int
    entity_type: str
    entity_id: str
    kind: str
    label: str
    is_quality_alert: bool
    filename: str
    content_type: str
    file_size: int
    uploaded_by: str
    created_at: dt.datetime
