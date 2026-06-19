from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class ServiceHistory(BaseModel):
    date: datetime
    mileage: Optional[int] = None
    description: str
    wip_id: Optional[str] = None
    outlet_id: Optional[str] = None


class Vehicle(Document):
    dealer_group_id: str
    outlet_id: str

    vin: Optional[str] = None
    registration: Optional[str] = None
    make: str
    model: str
    derivative: Optional[str] = None
    colour: Optional[str] = None
    interior_colour: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    engine_cc: Optional[int] = None
    year: Optional[int] = None
    mileage: Optional[int] = None

    # OEM / manufacturer identifiers
    manufacturer_vehicle_id: Optional[str] = None
    brand_id: Optional[str] = None  # e.g. "BMW", "MINI", "VW"

    # Service schedule
    last_service_date: Optional[datetime] = None
    next_service_due_date: Optional[datetime] = None
    next_service_due_mileage: Optional[int] = None
    mot_due_date: Optional[datetime] = None

    service_history: list[ServiceHistory] = Field(default_factory=list)

    source: str = "manual"
    is_deleted: bool = False

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "vehicles"
        indexes = [
            IndexModel([("vin", ASCENDING)], sparse=True),
            IndexModel([("registration", ASCENDING)], sparse=True),
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("manufacturer_vehicle_id", ASCENDING)], sparse=True),
        ]
