"""
Dynamic MQTT integration configuration.

Allows operators to map arbitrary MQTT topics (from any OEM system) to AMX
entities without code changes. Each MqttIntegration record describes:
  - Which topic pattern to subscribe to
  - How to extract the outlet_id from the topic or payload
  - A list of field mappings (source_path → target_field with optional transforms)
  - Conditions that must be satisfied before processing
  - Post-processing actions to fire after the entity is created/updated

Topic patterns support standard MQTT wildcards:
  +  = any single segment
  #  = any number of remaining segments (must be last)

Source path syntax:
  "field"              → payload["field"]
  "parent.child"       → payload["parent"]["child"]
  "list.0.field"       → payload["list"][0]["field"]
  "@topic.2"           → topic.split("/")[2]
  "@topic.-1"          → last segment of topic

Transform values:
  uppercase | lowercase | strip | float | int | bool
  date_iso   → parse ISO 8601 datetime string
  date_uk    → parse DD/MM/YYYY
  replace:old:new → str replace
"""
from datetime import datetime
from typing import Any, Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class FieldMapping(BaseModel):
    source_path: str
    target_field: str
    transform: Optional[str] = None
    default_value: Optional[Any] = None
    required: bool = False


class MqttCondition(BaseModel):
    """A single condition that must hold for a message to be processed."""
    field: str          # source_path into payload
    operator: str       # "eq" | "ne" | "in" | "not_in" | "contains" | "exists" | "not_exists"
    value: Optional[Any] = None


class MqttIntegration(Document):
    dealer_group_id: str
    name: str
    description: Optional[str] = None

    # ---- Subscription ----
    topic_pattern: str          # e.g. "ext/+/orders/new" or "oem/bmw/#"
    qos: int = 1

    # ---- Outlet resolution ----
    # "topic:{N}"      → topic.split("/")[N]  (supports negative index)
    # "payload:{path}" → dot-notation into payload
    # "fixed:{value}"  → literal string
    outlet_id_source: str = "fixed:default"

    # ---- Target ----
    # "order" | "customer" | "vehicle" | "wip" | "c2v" | "handover" | "recall"
    target_entity: str
    # "create" | "update" | "upsert"
    target_operation: str = "upsert"

    # ---- Mapping ----
    field_mappings: list[FieldMapping] = Field(default_factory=list)
    conditions: list[MqttCondition] = Field(default_factory=list)

    # ---- Post-actions ----
    # Identifiers of actions to run after entity persisted.
    # e.g. "notify:booking_confirmation", "notify:vehicle_ready",
    #      "auto_link_customer", "plan_pdi", "allocate_parts"
    post_actions: list[str] = Field(default_factory=list)

    is_active: bool = True

    # Runtime stats (updated on each processed message)
    last_message_at: Optional[datetime] = None
    last_message_status: Optional[str] = None  # "ok" | "error" | "skipped"
    total_messages: int = 0
    total_errors: int = 0

    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "mqtt_integrations"
        indexes = [
            IndexModel([("dealer_group_id", ASCENDING), ("is_active", ASCENDING)]),
            IndexModel([("dealer_group_id", ASCENDING), ("target_entity", ASCENDING)]),
        ]
