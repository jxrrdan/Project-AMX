from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class MqttEvent(Document):
    """Immutable audit log of all inbound MQTT messages."""
    dealer_group_id: str
    outlet_id: Optional[str] = None

    topic: str
    payload: dict = Field(default_factory=dict)

    # Processing outcome
    processed: bool = False
    processing_error: Optional[str] = None
    created_document_id: Optional[str] = None  # ID of order/wip/customer created
    created_document_type: Optional[str] = None

    received_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "mqtt_events"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("received_at", ASCENDING)]),
            IndexModel([("topic", ASCENDING)]),
            IndexModel([("processed", ASCENDING)]),
        ]
