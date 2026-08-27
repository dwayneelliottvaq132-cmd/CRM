import datetime as dt

from pydantic import Field

from app.schemas.common import ORMModel

# Free-text roles the app recognises today (see app.models.user.User.role comment).
# Not an enum in the model, so not enforced as one here either — validated in the
# service layer instead, where the message can name the valid set.
ROLES = ("Quality Manager", "Operator", "Accountant", "Admin")


class UserOut(ORMModel):
    id: int
    name: str
    initials: str
    email: str
    role: str
    is_active: bool
    has_pin: bool = False
    created_at: dt.datetime
    last_login_at: dt.datetime | None = None


class MeUpdate(ORMModel):
    """PATCH /users/me — a user editing their own profile. Changing the password
    requires proving the current one; changing anything else does not."""
    name: str | None = None
    initials: str | None = Field(default=None, max_length=4)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8)


class UserCreate(ORMModel):
    name: str
    initials: str | None = Field(default=None, max_length=4)
    email: str
    role: str
    password: str = Field(min_length=8)


class UserAdminUpdate(ORMModel):
    """PATCH /users/{id} — admin editing someone else. No current-password check:
    the admin's own login already gated this endpoint."""
    name: str | None = None
    initials: str | None = Field(default=None, max_length=4)
    role: str | None = None
    is_active: bool | None = None
    new_password: str | None = Field(default=None, min_length=8)


class PinEnroll(ORMModel):
    pin: str = Field(min_length=4, max_length=8)
