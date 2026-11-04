from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User, UserRole


ACCOUNTS = [
    {
        "full_name": "System Owner",
        "email": "owner@haven.local",
        "password": "Owner123!",
        "role": UserRole.OWNER,
    },
    {
        "full_name": "Property Caretaker",
        "email": "caretaker@haven.local",
        "password": "Caretaker123!",
        "role": UserRole.CARETAKER,
    },
]


def seed():
    with SessionLocal() as db:
        for account in ACCOUNTS:
            existing = db.scalar(
                select(User).where(User.email == account["email"])
            )
            if not existing:
                db.add(
                    User(
                        full_name=account["full_name"],
                        email=account["email"],
                        password_hash=hash_password(account["password"]),
                        role=account["role"],
                    )
                )

        db.commit()


if __name__ == "__main__":
    seed()
    print("Seed complete.")
    print("Owner: owner@haven.local / Owner123!")
    print("Caretaker: caretaker@haven.local / Caretaker123!")
