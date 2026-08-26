import datetime as dt
import hashlib

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_secret(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_secret(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


def hash_pin_lookup(raw: str) -> str:
    """Fast, non-bcrypt companion hash for shop-floor PIN lookups — see
    User.pin_lookup_hash for why this exists alongside the bcrypt pin_hash."""
    return hashlib.sha256(raw.encode()).hexdigest()


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = dt.datetime.utcnow() + dt.timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "exp": expire, **(extra_claims or {})}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
