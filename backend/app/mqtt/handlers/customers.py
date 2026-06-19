import logging

from app.models.mqtt_event import MqttEvent
from app.models.vehicle import Vehicle, ServiceHistory
from app.models.customer import CustomerVehicle
from app.services import customer_service
from datetime import datetime

logger = logging.getLogger(__name__)


async def handle(key: str, payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    event = MqttEvent(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_code,
        topic=key,
        payload=payload,
    )

    try:
        if key == "customers/sync":
            customer, created = await customer_service.upsert_from_mqtt(
                dealer_group_id, outlet_code, payload
            )
            event.processed = True
            event.created_document_id = str(customer.id)
            event.created_document_type = "customer"
            action = "created" if created else "updated"
            logger.info("Customer %s %s — %s %s", action, customer.id, customer.first_name, customer.last_name)

        elif key == "vehicles/sync":
            await _upsert_vehicle(payload, dealer_group_id, outlet_code)
            event.processed = True
            event.created_document_type = "vehicle"

        elif key == "c2v/sync":
            await _upsert_c2v(payload, dealer_group_id, outlet_code)
            event.processed = True
            event.created_document_type = "customer_vehicle"

    except Exception as exc:
        event.processing_error = str(exc)
        logger.exception("Failed to process %s payload", key)
    finally:
        await event.insert()


async def _upsert_vehicle(payload: dict, dealer_group_id: str, outlet_code: str) -> Vehicle:
    vin = payload.get("vin")
    mfr_vehicle_id = payload.get("manufacturer_vehicle_id")

    existing = None
    if vin:
        existing = await Vehicle.find_one(
            Vehicle.dealer_group_id == dealer_group_id,
            Vehicle.vin == vin,
        )
    if not existing and mfr_vehicle_id:
        existing = await Vehicle.find_one(
            Vehicle.dealer_group_id == dealer_group_id,
            Vehicle.manufacturer_vehicle_id == mfr_vehicle_id,
        )

    if existing:
        for field in ["mileage", "colour", "next_service_due_date", "next_service_due_mileage", "mot_due_date"]:
            if payload.get(field):
                setattr(existing, field, payload[field])
        existing.updated_at = datetime.utcnow()
        await existing.save()
        return existing

    vehicle = Vehicle(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_code,
        vin=vin,
        registration=payload.get("registration"),
        make=payload.get("make", "Unknown"),
        model=payload.get("model", "Unknown"),
        derivative=payload.get("derivative"),
        colour=payload.get("colour"),
        fuel_type=payload.get("fuel_type"),
        transmission=payload.get("transmission"),
        year=payload.get("year"),
        mileage=payload.get("mileage"),
        manufacturer_vehicle_id=mfr_vehicle_id,
        brand_id=payload.get("brand_id"),
        source="mqtt_sync",
    )
    await vehicle.insert()
    return vehicle


async def _upsert_c2v(payload: dict, dealer_group_id: str, outlet_code: str) -> None:
    customer_id = payload.get("customer_id")
    vehicle_id = payload.get("vehicle_id")
    mfr_c2v_id = payload.get("manufacturer_c2v_id")

    if not customer_id or not vehicle_id:
        logger.warning("c2v/sync missing customer_id or vehicle_id")
        return

    existing = await CustomerVehicle.find_one(
        CustomerVehicle.dealer_group_id == dealer_group_id,
        CustomerVehicle.customer_id == customer_id,
        CustomerVehicle.vehicle_id == vehicle_id,
    )
    if existing:
        return

    await CustomerVehicle(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_code,
        customer_id=customer_id,
        vehicle_id=vehicle_id,
        relationship_type=payload.get("relationship_type", "owner"),
        is_primary=payload.get("is_primary", True),
        manufacturer_c2v_id=mfr_c2v_id,
    ).insert()
