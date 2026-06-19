"""
MQTT subscription client.

Topic convention (all beneath the configured prefix):
  {prefix}/{dealer_group_id}/{outlet_code}/orders/new
  {prefix}/{dealer_group_id}/{outlet_code}/orders/update
  {prefix}/{dealer_group_id}/{outlet_code}/wips/new
  {prefix}/{dealer_group_id}/{outlet_code}/wips/update
  {prefix}/{dealer_group_id}/{outlet_code}/customers/sync
  {prefix}/{dealer_group_id}/{outlet_code}/vehicles/sync
  {prefix}/{dealer_group_id}/{outlet_code}/c2v/sync
"""
import asyncio
import json
import logging

import aiomqtt

from app.core.config import get_settings
from app.mqtt.handlers import orders as order_handler
from app.mqtt.handlers import wips as wip_handler
from app.mqtt.handlers import customers as customer_handler

logger = logging.getLogger(__name__)


def _route(topic: str) -> str:
    """Return the last two path segments as a routing key, e.g. 'orders/new'."""
    parts = topic.split("/")
    return "/".join(parts[-2:]) if len(parts) >= 2 else topic


async def _dispatch(topic: str, payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    key = _route(topic)
    try:
        if key in ("orders/new", "orders/update"):
            await order_handler.handle(payload, dealer_group_id, outlet_code)
        elif key in ("wips/new", "wips/update"):
            await wip_handler.handle(payload, dealer_group_id, outlet_code)
        elif key in ("customers/sync", "vehicles/sync", "c2v/sync"):
            await customer_handler.handle(key, payload, dealer_group_id, outlet_code)
        else:
            logger.debug("Unhandled topic: %s", topic)
    except Exception:
        logger.exception("Error dispatching MQTT message on topic %s", topic)


async def run_mqtt_client() -> None:
    settings = get_settings()
    prefix = settings.MQTT_TOPIC_PREFIX
    dealer_group_id = settings.DEALER_GROUP_ID
    wildcard = f"{prefix}/{dealer_group_id}/#"

    tls_params = aiomqtt.TLSParameters() if settings.MQTT_USE_TLS else None

    while True:
        try:
            async with aiomqtt.Client(
                hostname=settings.MQTT_BROKER_HOST,
                port=settings.MQTT_BROKER_PORT,
                username=settings.MQTT_USERNAME,
                password=settings.MQTT_PASSWORD,
                tls_params=tls_params,
                identifier=settings.MQTT_CLIENT_ID,
            ) as client:
                logger.info("MQTT connected — subscribing to %s", wildcard)
                await client.subscribe(wildcard, qos=1)

                async for message in client.messages:
                    topic = str(message.topic)
                    parts = topic.split("/")
                    outlet_code = parts[2] if len(parts) > 2 else "unknown"

                    try:
                        payload = json.loads(message.payload.decode())
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        logger.warning("Non-JSON payload on topic %s", topic)
                        continue

                    asyncio.create_task(_dispatch(topic, payload, dealer_group_id, outlet_code))

        except aiomqtt.MqttError as exc:
            logger.warning("MQTT disconnected (%s) — reconnecting in 5 s", exc)
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            logger.info("MQTT client task cancelled")
            return
