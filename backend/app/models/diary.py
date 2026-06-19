from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class DiarySlot(Document):
    dealer_group_id: str
    outlet_id: str

    # "workshop_booking" | "sales_handover" | "test_drive" | "block"
    slot_type: str

    # Linked documents
    wip_id: Optional[str] = None
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_registration: Optional[str] = None
    customer_name: Optional[str] = None

    # Timing
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 0

    # Assignment
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    # "technician" | "advisor"
    assigned_to_type: str = "technician"

    bay: Optional[str] = None

    # "booked" | "arrived" | "in_progress" | "complete" | "cancelled" | "no_show"
    status: str = "booked"

    # "wait" | "collect_deliver" | "courtesy_car" | None
    transport_type: Optional[str] = None

    notes: Optional[str] = None

    # "manual" | "mqtt_sync"
    source: str = "manual"

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "diary_slots"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("start_time", ASCENDING)]),
            IndexModel([("assigned_to_id", ASCENDING)]),
            IndexModel([("wip_id", ASCENDING)], sparse=True),
            IndexModel([("order_id", ASCENDING)], sparse=True),
        ]
