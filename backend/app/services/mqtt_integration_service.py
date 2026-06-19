"""
Dynamic MQTT integration processor.

Loads active MqttIntegration configs, matches incoming messages against their
topic patterns, applies field mappings, and dispatches to the appropriate service.
No code changes required for new OEM integrations — operators configure everything
via the admin UI.
"""
import logging
import re
from datetime import datetime
from typing import Any, Optional

from app.models.mqtt_integration import MqttIntegration, FieldMapping, MqttCondition
from app.models.mqtt_event import MqttEvent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Available target fields per entity — exposed to the UI for mapping hints
# ---------------------------------------------------------------------------

ENTITY_SCHEMA: dict[str, dict] = {
    "order": {
        "description": "Signed vehicle order received from OEM",
        "required_fields": ["oem_order_id", "ordered_model"],
        "fields": {
            "oem_order_id": "string — unique OEM order reference (required)",
            "oem_order_ref": "string — human-readable order number",
            "brand_id": "string — brand code e.g. BMW, MINI, VW",
            "manufacturer_customer_id": "string — OEM customer ID (used for customer linking)",
            "ordered_vin": "string — VIN of the ordered vehicle",
            "ordered_model": "string — model name (required)",
            "ordered_derivative": "string — variant / derivative",
            "ordered_colour": "string — exterior colour",
            "ordered_interior_colour": "string — interior colour",
            "order_date": "datetime — ISO 8601",
            "expected_delivery_date": "date — YYYY-MM-DD",
            "accessory_lines": "array — [{part_number, description, quantity, unit_price, total_price}]",
        },
    },
    "customer": {
        "description": "Customer record sync from OEM CRM",
        "required_fields": ["first_name", "last_name"],
        "fields": {
            "brand_id": "string",
            "manufacturer_customer_id": "string — OEM customer ID",
            "system_id": "string — which OEM system this came from",
            "first_name": "string (required)",
            "last_name": "string (required)",
            "email": "string",
            "phone": "string",
            "mobile": "string",
            "address_line_1": "string",
            "address_line_2": "string",
            "town": "string",
            "county": "string",
            "postcode": "string",
        },
    },
    "vehicle": {
        "description": "Vehicle record sync from OEM",
        "required_fields": ["make", "model"],
        "fields": {
            "vin": "string",
            "registration": "string",
            "make": "string (required)",
            "model": "string (required)",
            "derivative": "string",
            "colour": "string",
            "fuel_type": "string",
            "transmission": "string",
            "year": "integer",
            "mileage": "integer",
            "brand_id": "string",
            "manufacturer_vehicle_id": "string — OEM vehicle ID",
        },
    },
    "wip": {
        "description": "Work in Progress job card from OEM workshop system",
        "required_fields": ["oem_wip_id"],
        "fields": {
            "oem_wip_id": "string — unique OEM WIP reference (required)",
            "oem_wip_ref": "string — human-readable WIP number",
            "brand_id": "string",
            "manufacturer_customer_id": "string",
            "vehicle_vin": "string",
            "vehicle_registration": "string",
            "vehicle_make": "string",
            "vehicle_model": "string",
            "vehicle_mileage_in": "integer",
            "job_type": "string — warranty|service|repair|pdi|recall|bodyshop",
            "booking_date": "datetime — ISO 8601",
            "promised_date": "datetime — ISO 8601",
            "vhc_required": "boolean",
            "labour_lines": "array — [{op_code, description, hours, rate, total}]",
            "parts_lines": "array — [{part_number, description, quantity, unit_price, total_price}]",
        },
    },
    "c2v": {
        "description": "Customer-to-vehicle relationship",
        "required_fields": ["customer_id", "vehicle_id"],
        "fields": {
            "customer_id": "string — AMX customer document ID (required)",
            "vehicle_id": "string — AMX vehicle document ID (required)",
            "relationship_type": "string — owner|driver|contact|fleet_driver",
            "is_primary": "boolean",
            "manufacturer_c2v_id": "string — OEM C2V relationship ID",
        },
    },
    "handover": {
        "description": "Vehicle handover date confirmed by OEM — creates diary slot and optionally schedules PDI",
        "required_fields": ["oem_order_id", "handover_datetime"],
        "fields": {
            "oem_order_id": "string (required)",
            "handover_datetime": "datetime — ISO 8601 (required)",
            "advisor_id": "string — sales advisor user ID",
            "advisor_name": "string",
            "customer_id": "string",
            "vehicle_registration": "string",
        },
    },
    "recall": {
        "description": "Recall campaign from OEM",
        "required_fields": ["oem_campaign_code", "brand_id", "title"],
        "fields": {
            "oem_campaign_code": "string (required)",
            "brand_id": "string (required)",
            "title": "string (required)",
            "description": "string",
            "safety_recall": "boolean",
            "affected_models": "array of strings",
            "affected_vin_prefixes": "array of strings",
            "authorised_labour_hours": "float",
        },
    },
}


# ---------------------------------------------------------------------------
# Topic matching
# ---------------------------------------------------------------------------

def topic_matches(topic: str, pattern: str) -> bool:
    """Match an MQTT topic against a pattern supporting + and # wildcards."""
    topic_parts = topic.split("/")
    pattern_parts = pattern.split("/")

    for i, pp in enumerate(pattern_parts):
        if pp == "#":
            return True  # Matches all remaining segments
        if i >= len(topic_parts):
            return False
        if pp != "+" and pp != topic_parts[i]:
            return False

    return len(topic_parts) == len(pattern_parts)


# ---------------------------------------------------------------------------
# Field extraction
# ---------------------------------------------------------------------------

def extract_value(payload: dict, path: str, topic: str = "") -> Any:
    """
    Extract a value from the payload using dot notation, or from the topic
    using @topic.N syntax (supports negative indices).
    """
    if path.startswith("@topic."):
        idx_str = path[len("@topic."):]
        try:
            idx = int(idx_str)
            parts = topic.split("/")
            return parts[idx] if -len(parts) <= idx < len(parts) else None
        except (ValueError, IndexError):
            return None

    parts = path.split(".")
    current: Any = payload
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
        if current is None:
            return None
    return current


def apply_transform(value: Any, transform: Optional[str]) -> Any:
    """Apply a named transform to an extracted value."""
    if transform is None or value is None:
        return value
    t = transform.strip()
    if t == "uppercase":
        return str(value).upper()
    if t == "lowercase":
        return str(value).lower()
    if t == "strip":
        return str(value).strip()
    if t == "float":
        return float(value)
    if t == "int":
        return int(float(value))
    if t == "bool":
        if isinstance(value, bool):
            return value
        return str(value).lower() in ("true", "1", "yes")
    if t == "date_iso":
        if isinstance(value, datetime):
            return value
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if t == "date_uk":
        from datetime import datetime as dt
        return dt.strptime(str(value), "%d/%m/%Y")
    if t.startswith("replace:"):
        parts = t.split(":", 2)
        if len(parts) == 3:
            return str(value).replace(parts[1], parts[2])
    return value


def set_nested(data: dict, path: str, value: Any) -> None:
    """Set a value at a dot-notation path in a dict, creating intermediates."""
    parts = path.split(".")
    current = data
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = value


# ---------------------------------------------------------------------------
# Condition evaluation
# ---------------------------------------------------------------------------

def evaluate_conditions(conditions: list[MqttCondition], payload: dict, topic: str) -> bool:
    for cond in conditions:
        value = extract_value(payload, cond.field, topic)
        op = cond.operator
        cv = cond.value

        if op == "exists":
            if value is None:
                return False
        elif op == "not_exists":
            if value is not None:
                return False
        elif op == "eq":
            if value != cv:
                return False
        elif op == "ne":
            if value == cv:
                return False
        elif op == "in":
            if not isinstance(cv, list) or value not in cv:
                return False
        elif op == "not_in":
            if not isinstance(cv, list) or value in cv:
                return False
        elif op == "contains":
            if cv not in str(value):
                return False
    return True


# ---------------------------------------------------------------------------
# Outlet resolution
# ---------------------------------------------------------------------------

def resolve_outlet_id(source: str, topic: str, payload: dict) -> str:
    if source.startswith("fixed:"):
        return source[len("fixed:"):]
    if source.startswith("topic:"):
        idx_str = source[len("topic:"):]
        try:
            idx = int(idx_str)
            parts = topic.split("/")
            return parts[idx] if -len(parts) <= idx < len(parts) else "default"
        except (ValueError, IndexError):
            return "default"
    if source.startswith("payload:"):
        path = source[len("payload:"):]
        val = extract_value(payload, path, topic)
        return str(val) if val is not None else "default"
    return "default"


# ---------------------------------------------------------------------------
# Field mapping application
# ---------------------------------------------------------------------------

def apply_mappings(mappings: list[FieldMapping], payload: dict, topic: str) -> tuple[dict, list[str]]:
    """
    Apply all field mappings to build the normalised payload dict.
    Returns (mapped_dict, list_of_missing_required_fields).
    """
    result: dict = {}
    missing_required: list[str] = []

    for mapping in mappings:
        raw = extract_value(payload, mapping.source_path, topic)

        if raw is None:
            if mapping.default_value is not None:
                raw = mapping.default_value
            elif mapping.required:
                missing_required.append(mapping.source_path)
                continue
            else:
                continue

        try:
            value = apply_transform(raw, mapping.transform)
        except (ValueError, TypeError) as exc:
            logger.warning("Transform %s failed on %s=%r: %s", mapping.transform, mapping.source_path, raw, exc)
            if mapping.required:
                missing_required.append(mapping.source_path)
            continue

        set_nested(result, mapping.target_field, value)

    return result, missing_required


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

async def dispatch(
    target_entity: str,
    target_operation: str,
    mapped: dict,
    dealer_group_id: str,
    outlet_id: str,
) -> Optional[str]:
    """
    Call the appropriate service and return the created/updated document ID.
    """
    from app.services import (
        order_service,
        customer_service,
        wip_service,
    )

    if target_entity == "order":
        obj, _ = await order_service.upsert_from_mqtt(dealer_group_id, outlet_id, mapped)
        return str(obj.id)

    if target_entity == "customer":
        obj, _ = await customer_service.upsert_from_mqtt(dealer_group_id, outlet_id, mapped)
        return str(obj.id)

    if target_entity == "vehicle":
        from app.mqtt.handlers.customers import _upsert_vehicle
        obj = await _upsert_vehicle(mapped, dealer_group_id, outlet_id)
        return str(obj.id)

    if target_entity == "wip":
        obj, _ = await wip_service.upsert_from_mqtt(dealer_group_id, outlet_id, mapped)
        return str(obj.id)

    if target_entity == "c2v":
        from app.mqtt.handlers.customers import _upsert_c2v
        await _upsert_c2v(mapped, dealer_group_id, outlet_id)
        return None

    if target_entity == "handover":
        try:
            from app.services.diary_service import book_from_handover_mqtt
            slot = await book_from_handover_mqtt(dealer_group_id, outlet_id, mapped)
            return str(slot.id) if slot else None
        except Exception:
            logger.warning("diary_service not yet available, skipping handover dispatch")
            return None

    if target_entity == "recall":
        try:
            from app.services.recall_service import upsert_campaign_from_mqtt, identify_affected_vehicles
            campaign = await upsert_campaign_from_mqtt(dealer_group_id, mapped)
            await identify_affected_vehicles(str(campaign.id), dealer_group_id)
            return str(campaign.id)
        except Exception:
            logger.warning("recall_service not yet available, skipping recall dispatch")
            return None

    logger.warning("Unknown target_entity: %s", target_entity)
    return None


async def run_post_actions(
    actions: list[str],
    entity_id: Optional[str],
    target_entity: str,
    dealer_group_id: str,
    outlet_id: str,
) -> None:
    for action in actions:
        try:
            if action.startswith("notify:") and entity_id:
                template_code = action[len("notify:"):]
                await _run_notify(template_code, entity_id, target_entity, dealer_group_id)
            elif action == "auto_link_customer" and entity_id:
                await _run_auto_link(entity_id, target_entity, dealer_group_id)
            elif action == "plan_pdi" and entity_id and target_entity == "order":
                pass  # PDI planning requires a date — skip automatic scheduling
            elif action == "allocate_parts" and entity_id and target_entity == "wip":
                from app.services.wip_service import allocate_parts_stock
                await allocate_parts_stock(entity_id, dealer_group_id)
        except Exception as exc:
            logger.warning("Post-action %s failed: %s", action, exc)


async def _run_notify(template_code: str, entity_id: str, entity_type: str, dealer_group_id: str) -> None:
    try:
        from app.services import notification_service
        if entity_type == "wip" and template_code == "booking_confirmation":
            await notification_service.notify_booking_confirmed(entity_id, dealer_group_id)
        elif entity_type == "wip" and template_code == "vehicle_ready":
            await notification_service.notify_vehicle_ready(entity_id, dealer_group_id)
        elif entity_type == "vhc" and template_code == "vhc_results":
            await notification_service.notify_vhc_results(entity_id, dealer_group_id)
    except Exception as exc:
        logger.warning("Notification %s failed: %s", template_code, exc)


async def _run_auto_link(entity_id: str, entity_type: str, dealer_group_id: str) -> None:
    try:
        if entity_type == "order":
            from app.models.order import Order
            from app.services import customer_service
            order = await Order.get(entity_id)
            if order and not order.customer_id and order.manufacturer_customer_id:
                customer = await customer_service.find_by_manufacturer_id(
                    dealer_group_id, order.brand_id or "", order.manufacturer_customer_id
                )
                if customer:
                    order.customer_id = str(customer.id)
                    order.updated_at = datetime.utcnow()
                    await order.save()
    except Exception as exc:
        logger.warning("auto_link_customer failed: %s", exc)


# ---------------------------------------------------------------------------
# Main processor — called from the MQTT client for every inbound message
# ---------------------------------------------------------------------------

async def process_message(
    topic: str,
    payload: dict,
    dealer_group_id: str,
) -> int:
    """
    Match topic against all active integrations, apply mappings, dispatch.
    Returns the number of integrations that successfully processed the message.
    """
    integrations = await MqttIntegration.find(
        MqttIntegration.dealer_group_id == dealer_group_id,
        MqttIntegration.is_active == True,
    ).to_list()

    processed = 0

    for integration in integrations:
        if not topic_matches(topic, integration.topic_pattern):
            continue

        # Evaluate conditions
        if not evaluate_conditions(integration.conditions, payload, topic):
            await _update_stats(integration, "skipped")
            continue

        outlet_id = resolve_outlet_id(integration.outlet_id_source, topic, payload)
        mapped, missing = apply_mappings(integration.field_mappings, payload, topic)

        if missing:
            logger.warning(
                "Integration %s: required fields missing %s on topic %s",
                integration.name, missing, topic,
            )
            await _update_stats(integration, "error")
            continue

        # Log event
        event = MqttEvent(
            dealer_group_id=dealer_group_id,
            outlet_id=outlet_id,
            topic=topic,
            payload=payload,
        )

        try:
            entity_id = await dispatch(
                integration.target_entity,
                integration.target_operation,
                mapped,
                dealer_group_id,
                outlet_id,
            )
            event.processed = True
            event.created_document_id = entity_id
            event.created_document_type = integration.target_entity

            if integration.post_actions:
                await run_post_actions(
                    integration.post_actions,
                    entity_id,
                    integration.target_entity,
                    dealer_group_id,
                    outlet_id,
                )

            await _update_stats(integration, "ok")
            processed += 1

        except Exception as exc:
            event.processing_error = str(exc)
            logger.exception("Integration %s failed on topic %s", integration.name, topic)
            await _update_stats(integration, "error")
        finally:
            await event.insert()

    return processed


async def _update_stats(integration: MqttIntegration, status: str) -> None:
    integration.last_message_at = datetime.utcnow()
    integration.last_message_status = status
    integration.total_messages += 1
    if status == "error":
        integration.total_errors += 1
    integration.updated_at = datetime.utcnow()
    await integration.save()


# ---------------------------------------------------------------------------
# Dry-run / test utility (no DB writes)
# ---------------------------------------------------------------------------

def dry_run(
    integration: MqttIntegration,
    topic: str,
    payload: dict,
) -> dict:
    """
    Simulate processing without persisting anything.
    Returns a structured report for the test UI.
    """
    topic_ok = topic_matches(topic, integration.topic_pattern)
    conditions_ok = evaluate_conditions(integration.conditions, payload, topic) if topic_ok else False
    outlet_id = resolve_outlet_id(integration.outlet_id_source, topic, payload)
    mapped, missing = apply_mappings(integration.field_mappings, payload, topic)

    # Show per-mapping detail
    mapping_detail = []
    for fm in integration.field_mappings:
        raw = extract_value(payload, fm.source_path, topic)
        transformed = None
        error = None
        if raw is not None:
            try:
                transformed = apply_transform(raw, fm.transform)
            except Exception as exc:
                error = str(exc)
        mapping_detail.append({
            "source_path": fm.source_path,
            "target_field": fm.target_field,
            "transform": fm.transform,
            "raw_value": raw,
            "mapped_value": transformed,
            "error": error,
            "required": fm.required,
            "satisfied": raw is not None or fm.default_value is not None,
        })

    return {
        "topic_matches": topic_ok,
        "conditions_pass": conditions_ok,
        "outlet_id": outlet_id,
        "would_process": topic_ok and conditions_ok and not missing,
        "missing_required_fields": missing,
        "mapping_detail": mapping_detail,
        "mapped_payload": mapped,
        "target_entity": integration.target_entity,
        "target_operation": integration.target_operation,
        "post_actions": integration.post_actions,
    }
