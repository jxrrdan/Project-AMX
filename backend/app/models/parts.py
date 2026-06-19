from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class Part(Document):
    dealer_group_id: str
    brand_id: Optional[str] = None  # Parts can be brand-specific

    part_number: str
    description: str
    category: Optional[str] = None
    sub_category: Optional[str] = None

    unit_cost: float = 0.0
    unit_sell: float = 0.0

    superseded_by: Optional[str] = None  # Part number supersession

    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "parts"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("part_number", ASCENDING)], unique=True),
            IndexModel([("dealer_group_id", ASCENDING), ("brand_id", ASCENDING)]),
            IndexModel([("description", ASCENDING)]),
        ]


class StockLevel(Document):
    dealer_group_id: str
    outlet_id: str
    part_id: str
    part_number: str  # Denormalized for fast queries

    quantity_on_hand: int = 0
    quantity_allocated: int = 0  # Reserved for open WIPs
    quantity_on_order: int = 0
    quantity_available: int = 0  # on_hand - allocated

    reorder_point: int = 0
    reorder_quantity: int = 0

    bin_location: Optional[str] = None
    last_counted_at: Optional[datetime] = None
    last_received_at: Optional[datetime] = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "stock_levels"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING), ("part_number", ASCENDING)], unique=True),
            IndexModel([("part_id", ASCENDING)]),
        ]


class StockTransaction(Document):
    """Immutable ledger of every stock movement."""
    dealer_group_id: str
    outlet_id: str
    part_id: str
    part_number: str

    # "receipt" | "issue" | "return" | "adjustment" | "write_off" | "transfer_in" | "transfer_out"
    transaction_type: str

    quantity: int  # Positive = in, Negative = out
    unit_cost: float = 0.0

    reference_type: Optional[str] = None  # "wip" | "order" | "po" | "stocktake"
    reference_id: Optional[str] = None

    notes: Optional[str] = None
    created_by: Optional[str] = None  # User ID
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "stock_transactions"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("part_id", ASCENDING)]),
            IndexModel([("reference_id", ASCENDING)], sparse=True),
            IndexModel([("created_at", ASCENDING)]),
        ]
