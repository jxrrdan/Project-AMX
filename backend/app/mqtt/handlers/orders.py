import logging
from datetime import datetime

from app.models.mqtt_event import MqttEvent
from app.services import order_service

logger = logging.getLogger(__name__)


async def handle(payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    event = MqttEvent(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_code,
        topic=f"orders",
        payload=payload,
    )

    try:
        order, created = await order_service.upsert_from_mqtt(dealer_group_id, outlet_code, payload)
        event.processed = True
        event.created_document_id = str(order.id)
        event.created_document_type = "order"
        action = "created" if created else "updated"
        logger.info("Order %s %s (OEM ID: %s)", action, order.id, order.oem_order_id)
    except Exception as exc:
        event.processing_error = str(exc)
        logger.exception("Failed to process order payload")
    finally:
        await event.insert()
