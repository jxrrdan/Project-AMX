from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class User(Document):
    dealer_group_id: str
    outlet_ids: list[str] = Field(default_factory=list)  # Empty = access to all outlets

    email: str
    hashed_password: str

    first_name: str
    last_name: str
    # "admin" | "manager" | "advisor" | "technician" | "parts" | "readonly"
    role: str = "advisor"

    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("email", ASCENDING)], unique=True),
        ]
