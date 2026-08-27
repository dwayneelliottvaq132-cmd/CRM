"""User account and admin logic — kept out of the router so api/v1/users.py stays thin,
mirroring the rest of the codebase (see ncr_service.py, shipping_service.py).

PIN handling deserves a note. A shop-floor PIN is looked up by pin_lookup_hash (a fast
sha256 index — see the comment on User.pin_lookup_hash for why bcrypt is wrong there),
and the demo seed already occupies 1001-5005. A duplicate PIN would silently let one
operator's badge code resolve to a different operator's identity at the tank, so enrol_pin
below always checks for a collision first and raises rather than overwriting.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_pin_lookup, hash_secret, verify_secret
from app.models.user import User
from app.schemas.user import ROLES
from app.services.exceptions import BusinessRuleError, NotFoundError


def _derive_initials(name: str) -> str:
    initials = "".join(w[0] for w in name.split()[:2]).upper()
    return initials[:4] or "?"


def _validate_role(role: str) -> None:
    if role not in ROLES:
        raise BusinessRuleError(f"Unknown role {role!r} — must be one of {', '.join(ROLES)}")


def list_users(db: Session) -> list[User]:
    return db.execute(select(User).order_by(User.name)).scalars().all()


def create_user(db: Session, *, name: str, initials: str | None, email: str, role: str, password: str) -> User:
    _validate_role(role)
    existing = db.execute(select(User).where(func.lower(User.email) == email.lower())).scalar_one_or_none()
    if existing is not None:
        raise BusinessRuleError(f"A user with email {email} already exists")
    user = User(
        name=name,
        initials=initials or _derive_initials(name),
        email=email,
        role=role,
        password_hash=hash_secret(password),
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def update_self(db: Session, *, user: User, name: str | None, initials: str | None, current_password: str | None, new_password: str | None) -> User:
    if new_password is not None:
        if not current_password or not user.password_hash or not verify_secret(current_password, user.password_hash):
            raise BusinessRuleError("Current password is incorrect")
        user.password_hash = hash_secret(new_password)
    if name is not None:
        user.name = name
    if initials is not None:
        user.initials = initials
    db.flush()
    return user


def update_user_as_admin(db: Session, *, user: User, name: str | None, initials: str | None, role: str | None, is_active: bool | None, new_password: str | None) -> User:
    if role is not None:
        _validate_role(role)
        user.role = role
    if name is not None:
        user.name = name
    if initials is not None:
        user.initials = initials
    if is_active is not None:
        user.is_active = is_active
    if new_password is not None:
        user.password_hash = hash_secret(new_password)
    db.flush()
    return user


def enroll_pin(db: Session, *, user: User, pin: str) -> User:
    lookup = hash_pin_lookup(pin)
    collision = db.execute(
        select(User).where(User.pin_lookup_hash == lookup, User.id != user.id)
    ).scalar_one_or_none()
    if collision is not None:
        raise BusinessRuleError(f"PIN already assigned to {collision.name} — choose a different PIN")
    user.pin_hash = hash_secret(pin)
    user.pin_lookup_hash = lookup
    db.flush()
    return user


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    return user
