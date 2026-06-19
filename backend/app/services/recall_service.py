"""
Recall campaign service.

Handles campaign ingestion from OEM MQTT, affected-vehicle identification,
contact attempt logging and booking recall vehicles in for repair.
"""
import logging
from datetime import datetime, date
from typing import Optional

from app.models.recall import RecallCampaign, RecallVehicle, ContactAttempt
from app.models.vehicle import Vehicle
from app.models.wip import WIP

logger = logging.getLogger(__name__)


async def upsert_campaign_from_mqtt(
    dealer_group_id: str,
    payload: dict,
) -> RecallCampaign:
    """
    Create or update a RecallCampaign from an OEM MQTT recall/campaign message.
    Keyed on (dealer_group_id, oem_campaign_code).
    """
    oem_code: str = payload["oem_campaign_code"]

    existing = await RecallCampaign.find_one(
        RecallCampaign.dealer_group_id == dealer_group_id,
        RecallCampaign.oem_campaign_code == oem_code,
    )

    def _parse_date(val: Optional[str]) -> Optional[date]:
        if not val:
            return None
        try:
            return date.fromisoformat(val)
        except ValueError:
            return None

    if existing:
        existing.title = payload.get("title", existing.title)
        existing.description = payload.get("description", existing.description)
        existing.safety_recall = payload.get("safety_recall", existing.safety_recall)
        existing.affected_models = payload.get("affected_models", existing.affected_models)
        existing.affected_vin_prefixes = payload.get("affected_vin_prefixes", existing.affected_vin_prefixes)
        existing.affected_build_date_from = _parse_date(payload.get("affected_build_date_from")) or existing.affected_build_date_from
        existing.affected_build_date_to = _parse_date(payload.get("affected_build_date_to")) or existing.affected_build_date_to
        existing.authorised_labour_hours = payload.get("authorised_labour_hours", existing.authorised_labour_hours)
        existing.authorised_parts = payload.get("authorised_parts", existing.authorised_parts)
        existing.estimated_completion_time_minutes = payload.get(
            "estimated_completion_time_minutes", existing.estimated_completion_time_minutes
        )
        existing.status = payload.get("status", existing.status)
        existing.updated_at = datetime.utcnow()
        await existing.save()
        return existing

    campaign = RecallCampaign(
        dealer_group_id=dealer_group_id,
        brand_id=payload.get("brand_id", ""),
        oem_campaign_code=oem_code,
        title=payload.get("title", ""),
        description=payload.get("description", ""),
        safety_recall=payload.get("safety_recall", False),
        affected_models=payload.get("affected_models", []),
        affected_vin_prefixes=payload.get("affected_vin_prefixes", []),
        affected_build_date_from=_parse_date(payload.get("affected_build_date_from")),
        affected_build_date_to=_parse_date(payload.get("affected_build_date_to")),
        authorised_labour_hours=payload.get("authorised_labour_hours", 0.0),
        authorised_parts=payload.get("authorised_parts", []),
        estimated_completion_time_minutes=payload.get("estimated_completion_time_minutes", 60),
        status=payload.get("status", "active"),
        received_at=datetime.utcnow(),
    )
    await campaign.insert()
    logger.info("New recall campaign created: %s — %s", oem_code, campaign.title)
    return campaign


async def identify_affected_vehicles(
    campaign_id: str,
    dealer_group_id: str,
) -> int:
    """
    Query the Vehicle collection for vehicles matching the campaign's affected
    models or VIN prefixes. Create RecallVehicle records for any new matches.
    Returns the count of newly created RecallVehicle records.
    """
    campaign = await RecallCampaign.get(campaign_id)
    if not campaign or campaign.dealer_group_id != dealer_group_id:
        raise ValueError("Campaign not found")

    # Build vehicle filter conditions
    vin_prefixes = campaign.affected_vin_prefixes
    affected_models = campaign.affected_models

    if not vin_prefixes and not affected_models:
        logger.warning("Campaign %s has no VIN prefixes or models defined", campaign_id)
        return 0

    all_vehicles = await Vehicle.find(
        Vehicle.dealer_group_id == dealer_group_id,
    ).to_list()

    created_count = 0

    for vehicle in all_vehicles:
        vin: Optional[str] = getattr(vehicle, "vin", None)
        model: Optional[str] = getattr(vehicle, "model", None)

        matched = False

        if vin and vin_prefixes:
            if any(vin.upper().startswith(prefix.upper()) for prefix in vin_prefixes):
                matched = True

        if not matched and model and affected_models:
            if any(model.lower() == m.lower() for m in affected_models):
                matched = True

        if not matched:
            continue

        if not vin:
            continue  # Cannot create RecallVehicle without a VIN

        # Check not already recorded
        existing = await RecallVehicle.find_one(
            RecallVehicle.dealer_group_id == dealer_group_id,
            RecallVehicle.campaign_id == campaign_id,
            RecallVehicle.vehicle_vin == vin,
        )
        if existing:
            continue

        # Determine outlet_id from vehicle if available
        outlet_id: str = getattr(vehicle, "outlet_id", "") or ""

        rv = RecallVehicle(
            dealer_group_id=dealer_group_id,
            outlet_id=outlet_id,
            campaign_id=campaign_id,
            vehicle_id=str(vehicle.id),
            vehicle_vin=vin,
            vehicle_registration=getattr(vehicle, "registration", None),
            vehicle_make=getattr(vehicle, "make", None),
            vehicle_model=model,
            status="outstanding",
        )
        await rv.insert()
        created_count += 1

    logger.info(
        "identify_affected_vehicles: campaign %s — %d new recall vehicles created",
        campaign_id, created_count,
    )
    return created_count


async def log_contact_attempt(
    recall_vehicle_id: str,
    method: str,
    outcome: str,
    notes: Optional[str],
    user_id: str,
) -> RecallVehicle:
    """
    Append a contact attempt to the RecallVehicle and update flags accordingly.
    """
    rv = await RecallVehicle.get(recall_vehicle_id)
    if not rv:
        raise ValueError("RecallVehicle not found")

    attempt = ContactAttempt(
        method=method,
        attempted_at=datetime.utcnow(),
        outcome=outcome,
        notes=notes,
        attempted_by=user_id,
    )
    rv.contact_attempts.append(attempt)

    if outcome in ("spoke_to_customer", "booked"):
        rv.customer_contacted = True

    rv.updated_at = datetime.utcnow()
    await rv.save()
    return rv


async def book_recall(
    recall_vehicle_id: str,
    booking_date: datetime,
    dealer_group_id: str,
    outlet_id: str,
) -> tuple[RecallVehicle, WIP]:
    """
    Book a recall vehicle in for repair:
    1. Create a WIP with job_type="recall".
    2. Update RecallVehicle: status="booked", booked=True, booking_date=booking_date.
    3. Return (RecallVehicle, WIP).
    """
    rv = await RecallVehicle.get(recall_vehicle_id)
    if not rv or rv.dealer_group_id != dealer_group_id:
        raise ValueError("RecallVehicle not found")

    # Create WIP for the recall job
    wip = WIP(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        oem_wip_id=f"RECALL-{rv.campaign_id}-{rv.vehicle_vin}",
        customer_id=rv.customer_id,
        vehicle_id=rv.vehicle_id,
        vehicle_vin=rv.vehicle_vin,
        vehicle_registration=rv.vehicle_registration,
        vehicle_make=rv.vehicle_make,
        vehicle_model=rv.vehicle_model,
        job_type="recall",
        booking_date=booking_date,
        status="open",
        notes=f"Recall campaign {rv.campaign_id}",
    )
    await wip.insert()

    rv.booked = True
    rv.booking_date = booking_date
    rv.wip_id = str(wip.id)
    rv.status = "booked"
    rv.updated_at = datetime.utcnow()
    await rv.save()

    logger.info(
        "Recall vehicle %s booked: WIP %s created for campaign %s",
        recall_vehicle_id, wip.id, rv.campaign_id,
    )
    return rv, wip
