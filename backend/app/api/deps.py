from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import PortalUser, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_principal(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Accepts either a user-login JWT (sub=user id) or a client-credentials JWT
    (sub='api-client', scope='service') — both are valid bearer tokens for the API."""
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    return payload


def get_current_user(db: Session = Depends(get_db), principal: dict = Depends(get_current_principal)) -> User:
    if principal.get("scope") == "service":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This endpoint requires a user login, not a service token")
    user = db.get(User, int(principal["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def get_current_portal_user(db: Session = Depends(get_db), principal: dict = Depends(get_current_principal)) -> PortalUser:
    if principal.get("scope") != "portal":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This endpoint requires a customer portal login")
    portal_user = db.get(PortalUser, int(principal["sub"]))
    if portal_user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Portal user not found")
    return portal_user


def require_role(*roles: str):
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role in {roles}")
        return user

    return _check
