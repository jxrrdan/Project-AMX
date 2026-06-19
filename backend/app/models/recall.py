from datetime import datetime, date
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class ContactAttempt(BaseModel):
    # "phone" | "sms" | "email" | "letter"
    method: str
    attempted_at: datetime
    # "no_answer" | "left_message" | "spoke_to_customer" | "booked"
    outcome: str
    notes: Optional[str] = None
    attempted_by: str  # User ID


class RecallCampaign(Document):
    dealer_group_id: str
    brand_id: str

    oem_campaign_code: str  # From OEM
    title: str
    description: str

    safety_recall: bool = False  # True for safety-critical recalls

    affected_models: list[str] = Field(default_factory=list)
    affected_vin_prefixes: list[str] = Field(default_factory=list)
    affected_build_date_from: Optional[date] = None
    affected_build_date_to: Optional[date] = None

    authorised_labour_hours: float = 0.0
    authorised_parts: list[str] = Field(default_factory=list)  # Pre-auth parts list
    estimated_completion_time_minutes: int = 60

    # "active" | "completed" | "cancelled"
    status: str = "active"

    received_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "recall_campaigns"
        indexes = [
            IndexModel(
                [("dealer_group_id", ASCENDING), ("oem_campaign_code", ASCENDING)],
                unique=True,
            ),
            IndexModel([("brand_id", ASCENDING)]),
        ]


class RecallVehicle(Document):
    dealer_group_id: str
    outlet_id: str

    campaign_id: str
    vehicle_id: Optional[str] = None
    customer_id: Optional[str] = None

    vehicle_vin: str
    vehicle_registration: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None

    contact_attempts: list[ContactAttempt] = Field(default_factory=list)
    customer_contacted: bool = False

    booked: bool = False
    booking_date: Optional[datetime] = None
    wip_id: Optional[str] = None

    # "outstanding" | "booked" | "in_progress" | "completed" | "not_applicable" | "customer_refused"
    status: str = "outstanding"

    completed_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "recall_vehicles"
        indexes = [
            IndexModel(
                [("dealer_group_id", ASCENDING), ("campaign_id", ASCENDING), ("vehicle_vin", ASCENDING)],
                unique=True,
            ),
            IndexModel([("campaign_id", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)], sparse=True),
            IndexModel([("status", ASCENDING)]),
        ]
