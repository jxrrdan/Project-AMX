from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class Outlet(Document):
    dealer_group_id: str
    outlet_code: str  # Short alphanumeric code used in MQTT topic paths

    name: str
    brand_ids: list[str] = Field(default_factory=list)  # Brands sold/serviced here

    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: str = "GB"
    phone: Optional[str] = None
    email: Optional[str] = None

    # Per-brand OEM dealer codes
    oem_dealer_codes: dict = Field(default_factory=dict)  # {"BMW": "12345", "MINI": "67890"}

    # MQTT topic override — defaults to amx/{dealer_group_id}/{outlet_code}/...
    mqtt_topic_prefix: Optional[str] = None

    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "outlets"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_code", ASCENDING)], unique=True),
        ]
