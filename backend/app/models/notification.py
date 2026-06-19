from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class NotificationTemplate(Document):
    dealer_group_id: str
    outlet_id: Optional[str] = None  # None = group-wide default

    # "booking_confirmation" | "vehicle_ready" | "vhc_results" | "recall_contact" | "invoice_ready"
    template_code: str

    # "email" | "sms"
    channel: str

    subject: Optional[str] = None  # Email only
    body: str  # Jinja2 template with vars like {{customer_name}}, {{vehicle_registration}}

    is_active: bool = True

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notification_templates"
        indexes = [
            IndexModel(
                [("dealer_group_id", ASCENDING), ("template_code", ASCENDING), ("channel", ASCENDING)],
                unique=True,
            ),
        ]


class NotificationLog(Document):
    dealer_group_id: str
    outlet_id: str

    template_code: str
    channel: str  # "email" | "sms"

    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    customer_id: Optional[str] = None

    # "wip" | "order" | "vhc" | "recall" | "invoice"
    reference_type: str
    reference_id: str

    context: dict = Field(default_factory=dict)  # Template variables used

    # "pending" | "sent" | "delivered" | "failed"
    status: str = "pending"

    provider_message_id: Optional[str] = None  # SES/SNS message ID
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notification_logs"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)], sparse=True),
            IndexModel([("reference_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]
