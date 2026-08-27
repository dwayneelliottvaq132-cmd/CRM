"""Create or update a single ERP login, without touching the seeded demo data.

`seed.py` rebuilds the whole demo dataset; this is for adding one real person to an
existing database. Safe to re-run — an existing email is updated in place, so it can
be run again after a re-seed.

    python create_user.py                       # defaults below
    python create_user.py --email a@b.com --name "A. Bee" --role Admin --password s3cret

Roles the app recognises: Quality Manager, Operator, Accountant, Admin.
No shop-floor PIN is set: PINs are looked up by hash, and the demo seed already
uses 1001-5005. Assign one deliberately rather than colliding with an operator.
"""

import argparse
import sys

from app.core.security import hash_secret
from app.db import base  # noqa: F401  — registers every mapper; PortalUser -> Customer needs it
from app.db.session import SessionLocal
from app.models.user import User


def main() -> int:
    p = argparse.ArgumentParser(description="Create or update an ERP login.")
    p.add_argument("--email", default="dwayne.elliott@texasprecision.net")
    p.add_argument("--name", default="Dwayne Elliott")
    p.add_argument("--initials", default="")
    p.add_argument("--role", default="Quality Manager")
    p.add_argument("--password", default="surftec-demo")
    args = p.parse_args()

    # Derive initials from the name unless given: "Dwayne Elliott" -> "DE".
    initials = args.initials or "".join(w[0] for w in args.name.split()[:2]).upper()
    if len(initials) > 4:
        initials = initials[:4]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).one_or_none()
        action = "updated" if user else "created"
        if user is None:
            user = User(email=args.email)
            db.add(user)
        user.name = args.name
        user.initials = initials
        user.role = args.role
        user.password_hash = hash_secret(args.password)
        user.is_active = True
        db.commit()
        db.refresh(user)
        print(f"{action}: {user.name} <{user.email}>")
        print(f"  id       {user.id}")
        print(f"  initials {user.initials}")
        print(f"  role     {user.role}")
        print(f"  password {args.password}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
