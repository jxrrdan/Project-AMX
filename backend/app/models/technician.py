from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class Technician(Document):
    dealer_group_id: str
    outlet_id: str

    user_id: Optional[str] = None  # Linked User record

    tech_code: str  # Short code e.g. "JD01"
    name: str

    # "master" | "technician" | "apprentice" | "service_advisor"
    grade: str = "technician"

    contracted_hours_per_day: float = 7.5
    labour_rate: float = 0.0   # Selling rate per hour
    cost_rate: float = 0.0     # Internal cost rate per hour

    specialisms: list[str] = Field(default_factory=list)  # e.g. ["electrical", "diagnostics"]

    is_active: bool = True

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "technicians"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("tech_code", ASCENDING)], unique=True),
        ]


class TimeEntry(Document):
    dealer_group_id: str
    outlet_id: str

    technician_id: str

    wip_id: Optional[str] = None
    diary_slot_id: Optional[str] = None
    labour_op_code: Optional[str] = None

    # "on_job" | "waiting" | "non_productive" | "training" | "admin"
    clock_type: str

    started_at: datetime
    ended_at: Optional[datetime] = None
    hours: Optional[float] = None  # Set when clocked off

    is_open: bool = True
    notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "time_entries"
        indexes = [
            IndexModel([("technician_id", ASCENDING)]),
            IndexModel([("wip_id", ASCENDING)], sparse=True),
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
        ]
