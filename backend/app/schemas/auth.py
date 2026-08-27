from app.schemas.common import ORMModel


class Token(ORMModel):
    access_token: str
    token_type: str = "bearer"


class CurrentUser(ORMModel):
    id: int
    name: str
    initials: str
    email: str
    role: str
