from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class AccessoryLine(BaseModel):
    part_number: str
    description: str
    quantity: int = 1
    unit_price: float
    total_price: float
    fitted: bool = False


class Order(Document):
    dealer_group_id: str
    outlet_id: str

    # OEM identifiers
    oem_order_id: str
    oem_order_ref: Optional[str] = None
    brand_id: Optional[str] = None

    # Linked records (resolved after receipt via fuzzy match or manufacturer ID)
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    manufacturer_customer_id: Optional[str] = None

    # Vehicle being ordered
    ordered_vin: Optional[str] = None
    ordered_model: str
    ordered_derivative: Optional[str] = None
    ordered_colour: Optional[str] = None
    ordered_interior_colour: Optional[str] = None

    # Dealer-fitted accessories to invoice
    accessory_lines: list[AccessoryLine] = Field(default_factory=list)
    accessories_total: float = 0.0
    accessories_invoiced: bool = False
    accessories_invoice_date: Optional[datetime] = None
    accessories_invoice_ref: Optional[str] = None

    # PDI scheduling
    pdi_planned: bool = False
    pdi_planned_date: Optional[date] = None
    pdi_wip_id: Optional[str] = None

    # Key dates
    order_date: datetime
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None

    # Status lifecycle: received → accessories_invoiced → pdi_booked → pdi_complete → ready → delivered
    status: str = "received"

    notes: Optional[str] = None
    raw_payload: dict = Field(default_factory=dict)  # Original MQTT payload for audit

    received_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "orders"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("oem_order_id", ASCENDING)], unique=True),
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)], sparse=True),
        ]
