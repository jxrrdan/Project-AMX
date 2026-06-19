from datetime import datetime, date
from typing import Optional
from beanie import Document, Indexed
from pydantic import BaseModel, EmailStr, Field
from pymongo import IndexModel, ASCENDING


class ManufacturerRef(BaseModel):
    brand_id: str
    manufacturer_customer_id: str
    system_id: str  # Which OEM system (e.g. "BMW_CRM", "VW_SAP")


class MarketingPreferences(BaseModel):
    email_opt_in: bool = False
    sms_opt_in: bool = False
    postal_opt_in: bool = False
    phone_opt_in: bool = False
    last_updated: Optional[datetime] = None


class Customer(Document):
    dealer_group_id: str
    outlet_id: str

    title: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    date_of_birth: Optional[date] = None
    company_name: Optional[str] = None
    is_business: bool = False

    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: str = "GB"

    # OEM system references — allows lookup by manufacturer customer ID
    manufacturer_refs: list[ManufacturerRef] = Field(default_factory=list)

    marketing: MarketingPreferences = Field(default_factory=MarketingPreferences)

    source: str = "manual"  # "manual" | "mqtt_sync" | "api_import"
    is_deleted: bool = False

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "customers"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("last_name", ASCENDING), ("first_name", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("email", ASCENDING)]),
            IndexModel([("manufacturer_refs.manufacturer_customer_id", ASCENDING)]),
            IndexModel([("postcode", ASCENDING)]),
        ]


class CustomerVehicle(Document):
    """Many-to-many link between customers and vehicles (C2V)."""
    dealer_group_id: str
    outlet_id: str

    customer_id: str  # Customer document id
    vehicle_id: str   # Vehicle document id

    relationship_type: str = "owner"  # "owner" | "driver" | "contact" | "fleet_driver"
    is_primary: bool = True

    manufacturer_c2v_id: Optional[str] = None  # OEM's C2V relationship identifier

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "customer_vehicles"
        indexes = [
            IndexModel([("customer_id", ASCENDING)]),
            IndexModel([("vehicle_id", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("outlet_id", ASCENDING)]),
        ]
