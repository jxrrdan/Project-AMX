"""
MQTT handler for topic: recalls/campaign

Processes inbound recall campaign data from the OEM:
1. Upserts the RecallCampaign.
2. Identifies affected vehicles and creates RecallVehicle records.
3. Logs an MqttEvent.
"""
import logging

from app.models.mqtt_event import MqttEvent
from app.services import recall_service

logger = logging.getLogger(__name__)


async def handle(payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    """
    Process a recalls/campaign MQTT message.

    Expected payload keys: oem_campaign_code, brand_id, title, description,
    safety_recall, affected_models, affected_vin_prefixes, etc.
    """
    event = MqttEvent(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_code,
        topic="recalls/campaign",
        payload=payload,
    )

    try:
        campaign = await recall_service.upsert_campaign_from_mqtt(
            dealer_group_id=dealer_group_id,
            payload=payload,
        )

        new_vehicles = await recall_service.identify_affected_vehicles(
            campaign_id=str(campaign.id),
            dealer_group_id=dealer_group_id,
        )

        event.processed = True
        event.created_document_id = str(campaign.id)
        event.created_document_type = "recall_campaign"
        logger.info(
            "Recall campaign %s processed — %d new vehicles identified",
            campaign.oem_campaign_code,
            new_vehicles,
        )
    except Exception as exc:
        event.processing_error = str(exc)
        logger.exception(
            "Failed to process recalls/campaign payload (code=%s)",
            payload.get("oem_campaign_code"),
        )
    finally:
        await event.insert()
