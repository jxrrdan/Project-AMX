from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class VHCItem(BaseModel):
    category: str  # "tyres" | "brakes" | "lights" | "fluids" | "bodywork" | "underbody" | etc.
    item: str       # "nearside_front_tyre" | "engine_oil" | etc.
    description: str
    # "pass" | "advisory" | "fail" | "not_checked"
    condition: str = "not_checked"
    notes: Optional[str] = None
    image_urls: list[str] = Field(default_factory=list)
    measurement: Optional[str] = None  # e.g. tyre tread depth "3mm"


class AuthorisationItem(BaseModel):
    item_index: int  # Index into vhc_items
    description: str
    estimated_cost: float
    authorised: bool = False
    authorised_at: Optional[datetime] = None


class VHC(Document):
    dealer_group_id: str
    outlet_id: str

    wip_id: Optional[str] = None
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None

    technician_id: Optional[str] = None
    technician_name: Optional[str] = None

    vehicle_mileage: Optional[int] = None
    vehicle_registration: Optional[str] = None

    items: list[VHCItem] = Field(default_factory=list)

    # Counts computed from items
    pass_count: int = 0
    advisory_count: int = 0
    fail_count: int = 0

    # Items requiring customer authorisation (fails / advisories over threshold)
    authorisation_items: list[AuthorisationItem] = Field(default_factory=list)
    requires_authorisation: bool = False
    authorisation_requested_at: Optional[datetime] = None
    authorisation_method: Optional[str] = None  # "email" | "sms" | "in_person"

    authorised_at: Optional[datetime] = None
    authorised_by: Optional[str] = None  # Customer name or user ID

    # "draft" | "in_progress" | "awaiting_authorisation" | "authorised" | "declined" | "complete"
    status: str = "draft"

    notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "vhcs"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("wip_id", ASCENDING)], sparse=True),
            IndexModel([("customer_id", ASCENDING)], sparse=True),
            IndexModel([("vehicle_id", ASCENDING)], sparse=True),
            IndexModel([("status", ASCENDING)]),
        ]
