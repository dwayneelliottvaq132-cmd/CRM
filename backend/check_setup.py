"""Diagnose a failing ERP login.

Reads backend/.env exactly the way the app does, then reports which step of the
setup is missing. Run it from the backend directory with the venv active:

    python check_setup.py

Every line is read-only — nothing is created, migrated or modified.
"""

import sys
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.db import base  # noqa: F401  — registers every mapper before we query
from app.db.session import SessionLocal, engine
from app.models.user import PortalUser, User

OK, BAD, WARN = "  OK  ", " FAIL ", " WARN "


def redacted(url: str) -> str:
    """Hide the password but keep host/port/database visible — those are what go wrong."""
    parts = urlsplit(url)
    if parts.password:
        host = parts.netloc.split("@", 1)[1]
        parts = parts._replace(netloc=f"{parts.username}:***@{host}")
    return urlunsplit(parts)


def main() -> int:
    settings = get_settings()
    problems: list[str] = []

    print("DATABASE")
    print(f"   url        {redacted(settings.database_url)}")

    try:
        with engine.connect() as conn:
            print(f"{OK} connected")
            dbname = conn.execute(text("SELECT current_database()")).scalar()
            print(f"   database   {dbname}")
    except Exception as exc:  # noqa: BLE001 — this is the diagnosis
        print(f"{BAD} cannot connect: {type(exc).__name__}")
        print(f"       {str(exc).splitlines()[0]}")
        print("\n   Postgres is not running, or DATABASE_URL in backend/.env is wrong.")
        return 1

    print("\nSCHEMA")
    tables = set(inspect(engine).get_table_names())
    if "alembic_version" not in tables:
        print(f"{BAD} no alembic_version table — migrations have never run here")
        problems.append("alembic upgrade head")
    else:
        with engine.connect() as conn:
            rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        print(f"{OK} migrations applied (revision {rev})")
    print(f"   tables     {len(tables)}")

    if "users" not in tables:
        print(f"{BAD} no 'users' table")
        problems.append("alembic upgrade head")
        _summarise(problems)
        return 1

    print("\nLOGINS")
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.id).all()
        if not users:
            print(f"{BAD} the users table is empty — the database was never seeded")
            problems.append("python seed.py")
        else:
            with_pw = [u for u in users if u.password_hash]
            print(f"{OK} {len(users)} user(s), {len(with_pw)} with a password set")
            for u in users:
                mark = "password" if u.password_hash else "PIN only — cannot sign in on the web"
                print(f"   · {u.email:<42} {u.name:<18} {u.role:<16} {mark}")
            if not with_pw:
                print(f"{WARN} nobody has a password — every web login will be rejected")
                problems.append("python create_user.py")
        portals = db.query(PortalUser).count()
        print(f"   portal logins: {portals}")
    finally:
        db.close()

    _summarise(problems)
    return 1 if problems else 0


def _summarise(problems: list[str]) -> None:
    print()
    if not problems:
        print("Setup looks complete. If a login is still rejected, the password itself is")
        print("wrong, or the frontend is pointed at a different backend — check that")
        print("VITE_API_BASE_URL in frontend/.env matches the port uvicorn is serving.")
        return
    print("Run these, in order, from the backend directory with the venv active:")
    for step in dict.fromkeys(problems):
        print(f"   {step}")


if __name__ == "__main__":
    sys.exit(main())
