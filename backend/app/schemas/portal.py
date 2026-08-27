from app.schemas.common import ORMModel


class PortalJob(ORMModel):
    po: str
    part_number: str
    stage: str
    eta: str
    pct: int
    has_cert: bool
    cert_id: str | None


class PortalLoginRequest(ORMModel):
    email: str
    password: str
