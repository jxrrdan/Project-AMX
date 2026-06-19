from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class LabourLine(BaseModel):
    op_code: str
    description: str
    hours: float
    rate: float
    total: float
    technician_id: Optional[str] = None
    completed: bool = False
    completed_at: Optional[datetime] = None


class PartsLine(BaseModel):
    part_number: str
    description: str
    quantity: int = 1
    unit_price: float
    total_price: float
    # "required" | "picking" | "picked" | "fitted"
    status: str = "required"
    picked_at: Optional[datetime] = None
    fitted_at: Optional[datetime] = None


class WIP(Document):
    dealer_group_id: str
    outlet_id: str

    # OEM identifiers — WIP is created in the OEM system, mirrored here
    oem_wip_id: str
    oem_wip_ref: Optional[str] = None
    brand_id: Optional[str] = None

    # Linked records
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    order_id: Optional[str] = None  # If this WIP is a PDI for an order
    manufacturer_customer_id: Optional[str] = None
    vehicle_vin: Optional[str] = None
    vehicle_registration: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_mileage_in: Optional[int] = None
    vehicle_mileage_out: Optional[int] = None

    # Job classification
    # "warranty" | "service" | "repair" | "pdi" | "recall" | "bodyshop" | "vhc_only"
    job_type: str = "repair"

    labour_lines: list[LabourLine] = Field(default_factory=list)
    parts_lines: list[PartsLine] = Field(default_factory=list)

    # VHC linkage
    vhc_id: Optional[str] = None
    vhc_required: bool = False

    # Technician allocation
    allocated_technician_id: Optional[str] = None
    allocated_technician_name: Optional[str] = None

    # Financial summary (computed from lines)
    labour_total: float = 0.0
    parts_total: float = 0.0
    total: float = 0.0

    # Status lifecycle:
    # open → in_progress → awaiting_parts → awaiting_authorisation → ready → invoiced
    status: str = "open"

    # Dates
    booking_date: Optional[datetime] = None
    promised_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    invoiced_at: Optional[datetime] = None

    notes: Optional[str] = None
    raw_payload: dict = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "wips"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("oem_wip_id", ASCENDING)], unique=True),
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)], sparse=True),
            IndexModel([("vehicle_id", ASCENDING)], sparse=True),
            IndexModel([("vehicle_vin", ASCENDING)], sparse=True),
            IndexModel([("vehicle_registration", ASCENDING)], sparse=True),
        ]
