from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class WarrantyLine(BaseModel):
    # "labour" | "parts" | "sublet"
    line_type: str
    op_code: Optional[str] = None
    description: str
    quantity: float
    unit_amount: float
    claimed_amount: float
    settled_amount: float = 0.0
    # "claimed" | "approved" | "rejected" | "queried"
    status: str = "claimed"
    rejection_reason: Optional[str] = None


class WarrantyClaim(Document):
    dealer_group_id: str
    outlet_id: str

    wip_id: str
    brand_id: str

    oem_claim_reference: Optional[str] = None  # Assigned by OEM

    vehicle_vin: str
    vehicle_registration: Optional[str] = None
    vehicle_mileage: int

    failure_description: str
    cause_description: Optional[str] = None
    correction_description: Optional[str] = None

    auth_code: Optional[str] = None  # Pre-auth from OEM if required

    lines: list[WarrantyLine] = Field(default_factory=list)

    # Claimed amounts
    labour_claimed: float = 0.0
    parts_claimed: float = 0.0
    sublet_claimed: float = 0.0
    total_claimed: float = 0.0

    # Settled amounts
    labour_settled: float = 0.0
    parts_settled: float = 0.0
    sublet_settled: float = 0.0
    total_settled: float = 0.0

    # "draft" | "submitted" | "approved" | "settled" | "rejected" | "queried"
    status: str = "draft"

    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    settled_at: Optional[datetime] = None
    settlement_reference: Optional[str] = None
    rejection_reason: Optional[str] = None

    created_by: str  # User ID

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "warranty_claims"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("wip_id", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("oem_claim_reference", ASCENDING)], sparse=True),
            IndexModel([("status", ASCENDING)]),
        ]
