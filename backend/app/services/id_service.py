from sqlalchemy import select
from sqlalchemy.orm import Session


def next_id(db: Session, model_cls, base: str, width: int) -> str:
    """Generate the next sequential id for a string-PK model, e.g. base='J-26' width=3 -> 'J-26001'.
    Scans existing ids sharing the prefix and increments past the highest numeric suffix."""
    stmt = select(model_cls.id).where(model_cls.id.like(f"{base}%"))
    max_n = 0
    for existing in db.execute(stmt).scalars().all():
        suffix = existing[len(base):]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return f"{base}{max_n + 1:0{width}d}"
