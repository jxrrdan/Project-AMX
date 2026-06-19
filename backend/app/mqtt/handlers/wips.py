import logging

from app.models.mqtt_event import MqttEvent
from app.services import wip_service

logger = logging.getLogger(__name__)


async def handle(payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    event = MqttEvent(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_code,
        topic="wips",
        payload=payload,
    )

    try:
        wip, created = await wip_service.upsert_from_mqtt(dealer_group_id, outlet_code, payload)
        event.processed = True
        event.created_document_id = str(wip.id)
        event.created_document_type = "wip"
        action = "created" if created else "updated"
        logger.info("WIP %s %s (OEM ID: %s)", action, wip.id, wip.oem_wip_id)
    except Exception as exc:
        event.processing_error = str(exc)
        logger.exception("Failed to process WIP payload")
    finally:
        await event.insert()
