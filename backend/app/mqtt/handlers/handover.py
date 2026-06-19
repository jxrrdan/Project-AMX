"""
MQTT handler for topic: handover/confirmed

Payload schema:
{
    "oem_order_id": str,
    "handover_datetime": str (ISO 8601),
    "advisor_id": Optional[str],
    "advisor_name": Optional[str],
    "customer_id": Optional[str],
    "vehicle_registration": Optional[str],
    "outlet_code": Optional[str]
}
"""
import logging
from datetime import datetime

from app.models.mqtt_event import MqttEvent
from app.services import diary_service

logger = logging.getLogger(__name__)


async def handle(payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    """
    Process a handover/confirmed MQTT message.

    1. Finds the Order by oem_order_id.
    2. Updates order: actual_delivery_date, status → "ready".
    3. Creates a sales_handover DiarySlot.
    4. If pdi not planned: creates workshop_booking slot + stub PDI WIP.
    5. Logs an MqttEvent.
    """
    # Use outlet_code from payload if provided, else from topic
    effective_outlet = payload.get("outlet_code") or outlet_code

    event = MqttEvent(
        dealer_group_id=dealer_group_id,
        outlet_id=effective_outlet,
        topic="handover/confirmed",
        payload=payload,
    )

    try:
        slot = await diary_service.book_from_handover_mqtt(
            dealer_group_id=dealer_group_id,
            outlet_id=effective_outlet,
            payload=payload,
        )
        event.processed = True
        event.created_document_id = str(slot.id)
        event.created_document_type = "diary_slot"
        logger.info(
            "Handover confirmed for order %s — diary slot %s created",
            payload.get("oem_order_id"),
            slot.id,
        )
    except Exception as exc:
        event.processing_error = str(exc)
        logger.exception(
            "Failed to process handover/confirmed payload for order %s",
            payload.get("oem_order_id"),
        )
    finally:
        await event.insert()
