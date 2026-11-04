import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    OWNER = "owner"
    CARETAKER = "caretaker"
    TENANT = "tenant"


class HouseStatus(str, enum.Enum):
    VACANT = "vacant"
    OCCUPIED = "occupied"


class RequestType(str, enum.Enum):
    COMPLAINT = "complaint"
    REPAIR = "repair"
    ASSISTANCE = "assistance"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class NoticeStatus(str, enum.Enum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    tenant_profile: Mapped["TenantProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
    )


class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(primary_key=True)
    house_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[HouseStatus] = mapped_column(
        Enum(HouseStatus, native_enum=False),
        default=HouseStatus.VACANT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    tenant_profiles: Mapped[list["TenantProfile"]] = relationship(
        back_populates="house",
    )


class TenantProfile(Base):
    __tablename__ = "tenant_profiles"

    __table_args__ = (
        Index(
            "uq_tenant_house_current",
            "house_id",
            unique=True,
            postgresql_where=text("is_current IS TRUE"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    move_in_date: Mapped[date] = mapped_column(Date, default=date.today)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship(back_populates="tenant_profile")
    house: Mapped[House] = relationship(back_populates="tenant_profiles")


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    __table_args__ = (Index("ix_requests_status_created", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenant_profiles.id"))
    request_type: Mapped[RequestType] = mapped_column(
        Enum(RequestType, native_enum=False)
    )
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, native_enum=False),
        default=RequestStatus.PENDING,
    )
    caretaker_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenant_profiles.id"))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class LeavingNotice(Base):
    __tablename__ = "leaving_notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenant_profiles.id"))
    intended_departure: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[NoticeStatus] = mapped_column(
        Enum(NoticeStatus, native_enum=False),
        default=NoticeStatus.PENDING,
    )
    caretaker_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
