from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.rate import FinishRate
from app.models.user import User
from app.schemas.rate import FinishRateCreate, FinishRateOut, FinishRateUpdate

# Everyone signed in may READ rates — quoting needs them. Only Admin may change
# them: a rate edit moves every future quote, so it is an administrative act.
router = APIRouter(prefix="/rates", tags=["rates"], dependencies=[Depends(get_current_user)])


def _touch(rate: FinishRate, actor: User) -> None:
    import datetime as dt

    rate.updated_by = actor.name
    rate.updated_at = dt.datetime.now(dt.timezone.utc)


@router.get("", response_model=list[FinishRateOut])
def list_rates(db: Session = Depends(get_db)) -> list[FinishRate]:
    return list(db.execute(select(FinishRate).order_by(FinishRate.process, FinishRate.spec)).scalars().all())


@router.post("", response_model=FinishRateOut, status_code=status.HTTP_201_CREATED)
def create_rate(body: FinishRateCreate, db: Session = Depends(get_db), admin: User = Depends(require_role("Admin"))) -> FinishRate:
    rate = FinishRate(**body.model_dump())
    _touch(rate, admin)
    db.add(rate)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"A rate for '{body.process}' / '{body.spec}' already exists.")
    db.refresh(rate)
    return rate


@router.patch("/{rate_id}", response_model=FinishRateOut)
def update_rate(rate_id: int, body: FinishRateUpdate, db: Session = Depends(get_db), admin: User = Depends(require_role("Admin"))) -> FinishRate:
    rate = db.get(FinishRate, rate_id)
    if rate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rate not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rate, field, value)
    _touch(rate, admin)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Another rate already uses that process and spec.")
    db.refresh(rate)
    return rate


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate(rate_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role("Admin"))) -> None:
    rate = db.get(FinishRate, rate_id)
    if rate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rate not found")
    db.delete(rate)
    db.commit()
