import datetime as dt

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class User(Base):
    """Internal ERP user — quality staff, operators, accounting."""

    __tablename__ = "users"
    __table_args__ = (Index("ix_users_pin_lookup_hash", "pin_lookup_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    initials: Mapped[str] = mapped_column(String(4))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    role: Mapped[str] = mapped_column(String(60))  # Quality Manager, Operator, Accountant, Admin
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)  # shop-floor operator PIN (bcrypt)
    # fast-lookup companion to pin_hash: sha256(pin), indexed, so find_operator_by_pin can
    # do an O(1) exact match instead of bcrypt-verifying every operator in sequence (bcrypt
    # is deliberately slow — fine for a login password, unworkable as an O(n) scan gate for
    # a shop-floor kiosk). A PIN is a low-entropy operational badge code, not a password, so
    # a fast non-bcrypt hash here is an acceptable tradeoff. Backfilled lazily on first
    # verified match for pre-existing users (see find_operator_by_pin) rather than migrated,
    # since the plaintext PIN can't be recovered from an existing bcrypt hash.
    pin_lookup_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    last_login_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    @property
    def has_pin(self) -> bool:
        return self.pin_hash is not None


class PortalUser(Base):
    """External customer-portal login, scoped to a single customer."""

    __tablename__ = "portal_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)

    customer = relationship("Customer", back_populates="portal_users")
