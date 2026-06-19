from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class PrepCost(BaseModel):
    description: str
    cost: float
    supplier_id: Optional[str] = None
    completed: bool = False
    completed_at: Optional[datetime] = None


class UsedVehicle(Document):
    dealer_group_id: str
    outlet_id: str

    vehicle_id: str  # Links to Vehicle record
    stock_number: str  # Generated

    # "trade_in" | "auction" | "direct_purchase" | "oem_ex_demo" | "rental"
    acquisition_type: str
    acquisition_date: datetime
    acquisition_cost: float
    asking_price: float

    cap_clean: Optional[float] = None
    cap_average: Optional[float] = None
    minimum_price: Optional[float] = None  # Below which needs manager approval

    prep_costs: list[PrepCost] = Field(default_factory=list)
    total_prep_cost: float = 0.0
    prep_complete: bool = False
    total_investment: float = 0.0  # acquisition_cost + total_prep_cost
    gross_profit_target: float = 0.0

    # "in_prep" | "for_sale" | "reserved" | "sold" | "de-stocked"
    status: str = "in_prep"

    advertised_online: bool = False
    stocked_at: datetime = Field(default_factory=datetime.utcnow)
    sold_at: Optional[datetime] = None
    sale_price: Optional[float] = None
    sale_invoice_id: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "used_vehicles"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("stock_number", ASCENDING)], unique=True),
            IndexModel([("outlet_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("vehicle_id", ASCENDING)]),
        ]


class AppraiserNote(BaseModel):
    note: str
    created_by: str  # User ID
    created_at: datetime


class Appraisal(Document):
    dealer_group_id: str
    outlet_id: str

    registration: str
    make: str
    model: str
    derivative: Optional[str] = None
    mileage: int
    colour: Optional[str] = None
    fuel_type: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None

    # "excellent" | "good" | "fair" | "poor"
    bodywork_grade: str = "good"
    mechanical_grade: str = "good"
    interior_grade: str = "good"
    tyre_condition: str = "good"

    # "full" | "partial" | "none"
    service_history: str = "full"

    mot_months_remaining: Optional[int] = None
    notes: Optional[str] = None

    appraiser_notes: list[AppraiserNote] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)

    cap_clean: Optional[float] = None
    cap_average: Optional[float] = None
    trade_value: Optional[float] = None    # CAP or book value
    offered_price: Optional[float] = None  # What dealer offers customer
    accepted_price: Optional[float] = None

    customer_id: Optional[str] = None
    order_id: Optional[str] = None  # Part-exchange against a sale

    appraised_by: str  # User ID

    # "pending" | "accepted" | "declined" | "expired"
    status: str = "pending"

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "appraisals"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)], sparse=True),
            IndexModel([("status", ASCENDING)]),
        ]
