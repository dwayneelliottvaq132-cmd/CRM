from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.user import MeUpdate, PinEnroll, UserAdminUpdate, UserCreate, UserOut
from app.services import audit_service, user_service
from app.services.exceptions import BusinessRuleError, NotFoundError

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_current_user)])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: MeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> User:
    try:
        user_service.update_self(
            db,
            user=user,
            name=body.name,
            initials=body.initials,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=user.name, action="update_self", entity_type="user", entity_id=str(user.id), after=body.model_dump(exclude={"current_password", "new_password"}, exclude_none=True))
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_role("Admin"))])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return user_service.list_users(db)


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_role("Admin"))) -> User:
    try:
        new_user = user_service.create_user(db, name=body.name, initials=body.initials, email=body.email, role=body.role, password=body.password)
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=admin.name, action="create", entity_type="user", entity_id=str(new_user.id), after={"email": new_user.email, "role": new_user.role})
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserAdminUpdate, db: Session = Depends(get_db), admin: User = Depends(require_role("Admin"))) -> User:
    try:
        target = user_service.get_user_or_404(db, user_id)
        user_service.update_user_as_admin(
            db,
            user=target,
            name=body.name,
            initials=body.initials,
            role=body.role,
            is_active=body.is_active,
            new_password=body.new_password,
        )
    except NotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=admin.name, action="update", entity_type="user", entity_id=str(user_id), after=body.model_dump(exclude={"new_password"}, exclude_none=True))
    db.commit()
    db.refresh(target)
    return target


@router.post("/{user_id}/pin", response_model=UserOut)
def enroll_pin(user_id: int, body: PinEnroll, db: Session = Depends(get_db), admin: User = Depends(require_role("Admin"))) -> User:
    try:
        target = user_service.get_user_or_404(db, user_id)
        user_service.enroll_pin(db, user=target, pin=body.pin)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except BusinessRuleError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    audit_service.record(db, actor=admin.name, action="enroll_pin", entity_type="user", entity_id=str(user_id))
    db.commit()
    db.refresh(target)
    return target
