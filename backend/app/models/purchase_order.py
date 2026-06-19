from datetime import datetime, date
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class Supplier(Document):
    dealer_group_id: str

    name: str
    account_code: str

    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None

    payment_terms_days: int = 30
    gl_creditor_code: str = "3000"

    brand_ids: list[str] = Field(default_factory=list)  # Brands they supply

    is_active: bool = True

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "suppliers"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("account_code", ASCENDING)], unique=True),
        ]


class POLine(BaseModel):
    line_number: int
    part_number: Optional[str] = None
    description: str
    quantity: int
    unit_cost: float
    total_cost: float
    quantity_received: int = 0
    # "outstanding" | "partial" | "received"
    status: str = "outstanding"
    wip_id: Optional[str] = None  # For sublet lines


class PurchaseOrder(Document):
    dealer_group_id: str
    outlet_id: str

    po_number: str  # Generated: {outlet_code}-PO-{YYNNNNNN}
    supplier_id: str
    supplier_name: str

    # "parts" | "sublet" | "consumables" | "tooling"
    po_type: str = "parts"

    lines: list[POLine] = Field(default_factory=list)

    net_total: float = 0.0
    tax_total: float = 0.0
    gross_total: float = 0.0

    # "draft" | "sent" | "partial" | "received" | "invoiced" | "cancelled"
    status: str = "draft"

    wip_id: Optional[str] = None  # For sublet POs

    expected_delivery: Optional[date] = None
    delivery_notes: Optional[str] = None

    raised_by: str  # User ID
    raised_at: datetime = Field(default_factory=datetime.utcnow)
    received_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "purchase_orders"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("po_number", ASCENDING)], unique=True),
            IndexModel([("outlet_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("supplier_id", ASCENDING)]),
        ]
