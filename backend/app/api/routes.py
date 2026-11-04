from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import (
    Feedback,
    House,
    HouseStatus,
    LeavingNotice,
    NoticeStatus,
    RequestStatus,
    RequestType,
    ServiceRequest,
    TenantProfile,
    User,
    UserRole,
)

router = APIRouter(prefix="/api")


# ---------- Schemas ----------


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: str | None
    role: UserRole
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class HouseCreate(BaseModel):
    house_number: str = Field(min_length=1, max_length=30)
    description: str | None = None


class HouseOut(BaseModel):
    id: int
    house_number: str
    description: str | None
    status: HouseStatus

    model_config = ConfigDict(from_attributes=True)


class TenantCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    house_id: int
    password: str = Field(min_length=8, max_length=128)


class TenantUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    house_id: int


class TenantOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: str | None
    house_id: int
    house_number: str
    is_active: bool


class RequestCreate(BaseModel):
    request_type: RequestType
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5)


class RequestUpdate(BaseModel):
    status: RequestStatus
    caretaker_response: str | None = None
    scheduled_for: datetime | None = None


class RequestOut(BaseModel):
    id: int
    tenant_id: int
    request_type: RequestType
    title: str
    description: str
    status: RequestStatus
    caretaker_response: str | None
    scheduled_for: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeedbackCreate(BaseModel):
    message: str = Field(min_length=3)


class NoticeCreate(BaseModel):
    intended_departure: date
    reason: str = Field(min_length=5)


class NoticeUpdate(BaseModel):
    status: NoticeStatus
    caretaker_response: str | None = None


# ---------- Helpers ----------


def tenant_profile_for(db: Session, user: User) -> TenantProfile:
    profile = db.scalar(
        select(TenantProfile).where(
            TenantProfile.user_id == user.id,
            TenantProfile.is_current.is_(True),
        )
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Active tenant profile not found",
        )

    return profile


# ---------- Authentication ----------


@router.get("/auth/suggestions", response_model=list[str])
def account_suggestions(
    q: str = Query(min_length=1, max_length=80),
    db: Session = Depends(get_db),
):
    """Local demonstration helper for login autocomplete."""
    prefix = q.strip().lower()

    if not prefix:
        return []

    return db.scalars(
        select(User.email)
        .where(
            User.is_active.is_(True),
            func.lower(User.email).startswith(prefix),
        )
        .order_by(User.email)
        .limit(6)
    ).all()


@router.post("/auth/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == form.username.lower()))

    if (
        not user
        or not verify_password(form.password, user.password_hash)
        or not user.is_active
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    token = create_access_token(str(user.id), user.role.value)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
    }


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ---------- Dashboard ----------


@router.get("/dashboard")
def dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == UserRole.TENANT:
        profile = tenant_profile_for(db, user)

        requests = db.scalars(
            select(ServiceRequest)
            .where(ServiceRequest.tenant_id == profile.id)
            .order_by(ServiceRequest.created_at.desc())
        ).all()

        open_count = sum(
            request.status != RequestStatus.RESOLVED for request in requests
        )

        resolved_count = sum(
            request.status == RequestStatus.RESOLVED for request in requests
        )

        upcoming = db.scalars(
            select(ServiceRequest)
            .where(
                ServiceRequest.tenant_id == profile.id,
                ServiceRequest.scheduled_for.is_not(None),
                ServiceRequest.scheduled_for >= datetime.now(timezone.utc),
                ServiceRequest.status != RequestStatus.RESOLVED,
            )
            .order_by(ServiceRequest.scheduled_for.asc())
            .limit(5)
        ).all()

        feedback_count = (
            db.scalar(
                select(func.count())
                .select_from(Feedback)
                .where(Feedback.tenant_id == profile.id)
            )
            or 0
        )

        notice = db.scalar(
            select(LeavingNotice)
            .where(
                LeavingNotice.tenant_id == profile.id,
                LeavingNotice.status.in_(
                    [
                        NoticeStatus.PENDING,
                        NoticeStatus.ACKNOWLEDGED,
                    ]
                ),
            )
            .order_by(LeavingNotice.created_at.desc())
        )

        def request_summary(item):
            return {
                "id": item.id,
                "title": item.title,
                "request_type": item.request_type.value,
                "status": item.status.value,
                "caretaker_response": item.caretaker_response,
                "scheduled_for": item.scheduled_for,
                "created_at": item.created_at,
            }

        return {
            "role": "tenant",
            "house": {
                "house_number": profile.house.house_number,
                "description": profile.house.description,
                "move_in_date": profile.move_in_date,
            },
            "requests": {
                "total": len(requests),
                "open": open_count,
                "resolved": resolved_count,
                "recent": [request_summary(item) for item in requests[:5]],
                "upcoming": [request_summary(item) for item in upcoming],
            },
            "feedback_count": feedback_count,
            "leaving_notice": (
                {
                    "id": notice.id,
                    "intended_departure": notice.intended_departure,
                    "reason": notice.reason,
                    "status": notice.status.value,
                    "caretaker_response": notice.caretaker_response,
                    "created_at": notice.created_at,
                }
                if notice
                else None
            ),
        }

    total_houses = db.scalar(select(func.count()).select_from(House)) or 0

    occupied = (
        db.scalar(
            select(func.count())
            .select_from(House)
            .where(House.status == HouseStatus.OCCUPIED)
        )
        or 0
    )

    active_tenants = (
        db.scalar(
            select(func.count())
            .select_from(TenantProfile)
            .where(TenantProfile.is_current.is_(True))
        )
        or 0
    )

    open_requests = (
        db.scalar(
            select(func.count())
            .select_from(ServiceRequest)
            .where(ServiceRequest.status != RequestStatus.RESOLVED)
        )
        or 0
    )

    pending_notices = (
        db.scalar(
            select(func.count())
            .select_from(LeavingNotice)
            .where(LeavingNotice.status == NoticeStatus.PENDING)
        )
        or 0
    )

    return {
        "role": user.role.value,
        "total_houses": total_houses,
        "occupied_houses": occupied,
        "vacant_houses": total_houses - occupied,
        "active_tenants": active_tenants,
        "open_requests": open_requests,
        "pending_notices": pending_notices,
    }


# ---------- Houses ----------


@router.get("/houses", response_model=list[HouseOut])
def list_houses(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(select(House).order_by(House.house_number)).all()


@router.post("/houses", response_model=HouseOut, status_code=201)
def create_house(
    data: HouseCreate,
    user: User = Depends(require_roles(UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    house = House(
        house_number=data.house_number.strip(),
        description=data.description,
    )

    db.add(house)

    try:
        db.commit()
        db.refresh(house)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="House number already exists",
        )

    return house


# ---------- Tenant management ----------


@router.get("/tenants")
def list_tenants(
    user: User = Depends(require_roles(UserRole.OWNER, UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(TenantProfile, User, House)
        .join(User, TenantProfile.user_id == User.id)
        .join(House, TenantProfile.house_id == House.id)
        .where(TenantProfile.is_current.is_(True))
        .order_by(User.full_name)
    ).all()

    return [
        {
            "id": profile.id,
            "full_name": tenant.full_name,
            "email": tenant.email,
            "phone": tenant.phone,
            "house_id": house.id,
            "house_number": house.house_number,
            "is_active": tenant.is_active,
        }
        for profile, tenant, house in rows
    ]


@router.post("/tenants", response_model=TenantOut, status_code=201)
def create_tenant(
    data: TenantCreate,
    user: User = Depends(require_roles(UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    try:
        house = db.scalar(
            select(House).where(House.id == data.house_id).with_for_update()
        )

        if not house:
            raise HTTPException(
                status_code=404,
                detail="House not found",
            )

        if house.status != HouseStatus.VACANT:
            raise HTTPException(
                status_code=409,
                detail="House is already occupied",
            )

        email = str(data.email).lower()

        existing_user = db.scalar(select(User).where(User.email == email))

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Email is already registered",
            )

        tenant = User(
            full_name=data.full_name.strip(),
            email=email,
            phone=data.phone.strip(),
            password_hash=hash_password(data.password),
            role=UserRole.TENANT,
        )

        db.add(tenant)
        db.flush()

        profile = TenantProfile(
            user_id=tenant.id,
            house_id=house.id,
        )

        house.status = HouseStatus.OCCUPIED
        db.add(profile)
        db.flush()

        result = {
            "id": profile.id,
            "full_name": tenant.full_name,
            "email": tenant.email,
            "phone": tenant.phone,
            "house_id": house.id,
            "house_number": house.house_number,
            "is_active": tenant.is_active,
        }

        db.commit()
        return result

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "The house or email is already in use. " "Please refresh and try again."
            ),
        )


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    user: User = Depends(require_roles(UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    try:
        profile = db.scalar(
            select(TenantProfile)
            .where(
                TenantProfile.id == tenant_id,
                TenantProfile.is_current.is_(True),
            )
            .with_for_update()
        )

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Active tenant not found",
            )

        tenant = profile.user
        old_house_id = profile.house_id
        new_house_id = data.house_id

        house_ids = sorted({old_house_id, new_house_id})

        locked_houses = db.scalars(
            select(House)
            .where(House.id.in_(house_ids))
            .order_by(House.id)
            .with_for_update()
        ).all()

        houses_by_id = {house.id: house for house in locked_houses}

        old_house = houses_by_id.get(old_house_id)
        new_house = houses_by_id.get(new_house_id)

        if not new_house:
            raise HTTPException(
                status_code=404,
                detail="House not found",
            )

        if not old_house:
            raise HTTPException(
                status_code=409,
                detail="The tenant's current house could not be found",
            )

        if new_house_id != old_house_id and new_house.status != HouseStatus.VACANT:
            raise HTTPException(
                status_code=409,
                detail="The selected house is already occupied",
            )

        email = str(data.email).lower()

        existing_email = db.scalar(
            select(User).where(
                User.email == email,
                User.id != tenant.id,
            )
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail="Email is already registered",
            )

        tenant.full_name = data.full_name.strip()
        tenant.email = email
        tenant.phone = data.phone.strip()

        if new_house_id != old_house_id:
            old_house.status = HouseStatus.VACANT
            new_house.status = HouseStatus.OCCUPIED
            profile.house_id = new_house_id

        db.commit()
        db.refresh(profile)

        return {
            "id": profile.id,
            "full_name": tenant.full_name,
            "email": tenant.email,
            "phone": tenant.phone,
            "house_id": new_house.id,
            "house_number": new_house.house_number,
            "is_active": tenant.is_active,
        }

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The tenant details or house assignment conflict with existing data",
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update tenant details",
        )


@router.delete("/tenants/{tenant_id}")
def delete_tenant(
    tenant_id: int,
    user: User = Depends(require_roles(UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    try:
        profile = db.scalar(
            select(TenantProfile).where(TenantProfile.id == tenant_id).with_for_update()
        )

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Tenant not found",
            )

        tenant = profile.user
        house = profile.house

        # Only release the house if this profile is its current occupant.
        if profile.is_current:
            house.status = HouseStatus.VACANT

        # Remove all records that reference this tenant profile.
        db.execute(delete(ServiceRequest).where(ServiceRequest.tenant_id == profile.id))

        db.execute(delete(Feedback).where(Feedback.tenant_id == profile.id))

        db.execute(delete(LeavingNotice).where(LeavingNotice.tenant_id == profile.id))

        # Delete the profile before deleting its user account.
        db.delete(profile)
        db.flush()

        db.delete(tenant)
        db.commit()

        return {"message": "Tenant and associated records permanently deleted"}

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Tenant could not be deleted. "
                "Check for related records and try again."
            ),
        )


# ---------- Service requests ----------


@router.get("/requests", response_model=list[RequestOut])
def list_requests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(ServiceRequest).order_by(ServiceRequest.created_at.desc())

    if user.role == UserRole.TENANT:
        profile = tenant_profile_for(db, user)
        query = query.where(ServiceRequest.tenant_id == profile.id)

    return db.scalars(query).all()


@router.post("/requests", response_model=RequestOut, status_code=201)
def create_request(
    data: RequestCreate,
    user: User = Depends(require_roles(UserRole.TENANT)),
    db: Session = Depends(get_db),
):
    profile = tenant_profile_for(db, user)

    request = ServiceRequest(
        tenant_id=profile.id,
        request_type=data.request_type,
        title=data.title.strip(),
        description=data.description.strip(),
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return request


@router.patch("/requests/{request_id}", response_model=RequestOut)
def update_request(
    request_id: int,
    data: RequestUpdate,
    user: User = Depends(require_roles(UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    request = db.get(ServiceRequest, request_id)

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Request not found",
        )

    request.status = data.status

    if data.caretaker_response is not None:
        request.caretaker_response = data.caretaker_response

    request.scheduled_for = data.scheduled_for

    db.commit()
    db.refresh(request)

    return request


# ---------- Feedback ----------


@router.get("/feedback")
def list_feedback(
    user: User = Depends(require_roles(UserRole.OWNER, UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(Feedback, User, House)
        .join(TenantProfile, Feedback.tenant_id == TenantProfile.id)
        .join(User, TenantProfile.user_id == User.id)
        .join(House, TenantProfile.house_id == House.id)
        .order_by(Feedback.created_at.desc())
    ).all()

    return [
        {
            "id": item.id,
            "tenant": tenant.full_name,
            "house_number": house.house_number,
            "message": item.message,
            "created_at": item.created_at,
        }
        for item, tenant, house in rows
    ]


@router.post("/feedback", status_code=201)
def create_feedback(
    data: FeedbackCreate,
    user: User = Depends(require_roles(UserRole.TENANT)),
    db: Session = Depends(get_db),
):
    profile = tenant_profile_for(db, user)

    item = Feedback(
        tenant_id=profile.id,
        message=data.message.strip(),
    )

    db.add(item)
    db.commit()

    return {"message": "Feedback submitted successfully"}


# ---------- Leaving notices ----------


@router.get("/notices")
def list_notices(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        select(LeavingNotice, TenantProfile, User, House)
        .join(TenantProfile, LeavingNotice.tenant_id == TenantProfile.id)
        .join(User, TenantProfile.user_id == User.id)
        .join(House, TenantProfile.house_id == House.id)
        .order_by(LeavingNotice.created_at.desc())
    )

    if user.role == UserRole.TENANT:
        profile = tenant_profile_for(db, user)
        query = query.where(LeavingNotice.tenant_id == profile.id)

    rows = db.execute(query).all()

    return [
        {
            "id": notice.id,
            "tenant_id": profile.id,
            "tenant": tenant.full_name,
            "house_number": house.house_number,
            "intended_departure": notice.intended_departure,
            "reason": notice.reason,
            "status": notice.status,
            "caretaker_response": notice.caretaker_response,
            "created_at": notice.created_at,
        }
        for notice, profile, tenant, house in rows
    ]


@router.post("/notices", status_code=201)
def create_notice(
    data: NoticeCreate,
    user: User = Depends(require_roles(UserRole.TENANT)),
    db: Session = Depends(get_db),
):
    profile = tenant_profile_for(db, user)

    if data.intended_departure < date.today() + timedelta(days=30):
        raise HTTPException(
            status_code=400,
            detail="Please provide at least one month's notice",
        )

    existing = db.scalar(
        select(LeavingNotice).where(
            LeavingNotice.tenant_id == profile.id,
            LeavingNotice.status.in_(
                [
                    NoticeStatus.PENDING,
                    NoticeStatus.ACKNOWLEDGED,
                ]
            ),
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have an active leaving notice",
        )

    notice = LeavingNotice(
        tenant_id=profile.id,
        intended_departure=data.intended_departure,
        reason=data.reason.strip(),
    )

    db.add(notice)
    db.commit()

    return {"message": "Leaving notice submitted successfully"}


@router.patch("/notices/{notice_id}")
def update_notice(
    notice_id: int,
    data: NoticeUpdate,
    user: User = Depends(require_roles(UserRole.CARETAKER)),
    db: Session = Depends(get_db),
):
    notice = db.get(LeavingNotice, notice_id)

    if not notice:
        raise HTTPException(
            status_code=404,
            detail="Notice not found",
        )

    notice.status = data.status
    notice.caretaker_response = data.caretaker_response

    # Completing a notice does not automatically delete or deactivate a tenant.
    # Tenant removal is a separate caretaker action.

    db.commit()

    return {"message": "Leaving notice updated"}
