import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, verify_secret
from app.models.user import User
from app.schemas.auth import CurrentUser, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = db.execute(
        select(User).where(func.lower(User.email) == form.username.lower())
    ).scalar_one_or_none()
    if user is None or not user.password_hash or not verify_secret(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    # Checked after the password so this reveals nothing to someone who does not already
    # hold valid credentials. Without it a deactivated account still gets a 200 and a token
    # here, then 401s on every subsequent request (get_current_user rejects inactive users) —
    # which reads as a broken login rather than a closed account.
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated — contact an administrator.")
    user.last_login_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    token = create_access_token(subject=str(user.id), extra_claims={"role": user.role})
    return Token(access_token=token)


@router.get("/me", response_model=CurrentUser)
def me(user: User = Depends(get_current_user)) -> User:
    return user
