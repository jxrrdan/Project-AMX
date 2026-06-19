"""
Diary / scheduling service.

Handles workshop bookings, sales handovers, test drives and block-outs.
The book_from_handover_mqtt function is the integration point between the
MQTT handover/confirmed topic and the diary + order + WIP systems.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.models.diary import DiarySlot
from app.models.order import Order
from app.models.wip import WIP

logger = logging.getLogger(__name__)

# Working days offset — skip Saturday (5) and Sunday (6)
_WEEKEND = {5, 6}


def _add_working_days(start: datetime, days: int) -> datetime:
    """Advance start by `days` working days (Mon–Fri)."""
    current = start
    added = 0
    while added < days:
        current -= timedelta(days=1)
        if current.weekday() not in _WEEKEND:
            added += 1
    return current


async def get_slots_for_date_range(
    dealer_group_id: str,
    outlet_id: str,
    from_dt: datetime,
    to_dt: datetime,
    assigned_to_id: Optional[str] = None,
    slot_type: Optional[str] = None,
) -> list[DiarySlot]:
    """Return all diary slots within the given date range for an outlet."""
    filters = [
        DiarySlot.dealer_group_id == dealer_group_id,
        DiarySlot.outlet_id == outlet_id,
        DiarySlot.start_time >= from_dt,
        DiarySlot.start_time <= to_dt,
    ]
    if assigned_to_id:
        filters.append(DiarySlot.assigned_to_id == assigned_to_id)
    if slot_type:
        filters.append(DiarySlot.slot_type == slot_type)

    return await DiarySlot.find(*filters).sort(DiarySlot.start_time).to_list()


async def check_technician_availability(
    dealer_group_id: str,
    outlet_id: str,
    technician_id: str,
    start: datetime,
    end: datetime,
) -> bool:
    """
    Return True if the technician has no overlapping booked or in-progress slot.
    Overlap: existing.start_time < end AND existing.end_time > start
    """
    conflict = await DiarySlot.find_one(
        DiarySlot.dealer_group_id == dealer_group_id,
        DiarySlot.outlet_id == outlet_id,
        DiarySlot.assigned_to_id == technician_id,
        DiarySlot.status.in_(["booked", "in_progress"]),  # type: ignore[attr-defined]
        DiarySlot.start_time < end,
        DiarySlot.end_time > start,
    )
    return conflict is None


async def create_booking(
    dealer_group_id: str,
    outlet_id: str,
    data: dict,
) -> DiarySlot:
    """
    Validate that there is no technician overlap and create a diary slot.
    data keys mirror DiarySlot fields; start_time / end_time must be datetime objects.
    """
    start: datetime = data["start_time"]
    end: datetime = data["end_time"]
    assigned_to_id: Optional[str] = data.get("assigned_to_id")

    if assigned_to_id:
        available = await check_technician_availability(
            dealer_group_id, outlet_id, assigned_to_id, start, end
        )
        if not available:
            raise ValueError(
                f"Technician {assigned_to_id} is not available between {start} and {end}"
            )

    duration_minutes = int((end - start).total_seconds() / 60)

    slot = DiarySlot(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        slot_type=data.get("slot_type", "workshop_booking"),
        wip_id=data.get("wip_id"),
        order_id=data.get("order_id"),
        customer_id=data.get("customer_id"),
        vehicle_id=data.get("vehicle_id"),
        vehicle_registration=data.get("vehicle_registration"),
        customer_name=data.get("customer_name"),
        start_time=start,
        end_time=end,
        duration_minutes=duration_minutes,
        assigned_to_id=assigned_to_id,
        assigned_to_name=data.get("assigned_to_name"),
        assigned_to_type=data.get("assigned_to_type", "technician"),
        bay=data.get("bay"),
        status="booked",
        transport_type=data.get("transport_type"),
        notes=data.get("notes"),
        source=data.get("source", "manual"),
    )
    await slot.insert()
    return slot


async def book_from_handover_mqtt(
    dealer_group_id: str,
    outlet_id: str,
    payload: dict,
) -> DiarySlot:
    """
    Called from the MQTT handover/confirmed handler.

    Payload fields:
        oem_order_id, handover_datetime (ISO-8601), advisor_id (opt),
        advisor_name (opt), customer_id (opt), vehicle_registration (opt)

    Actions:
    1. Find the Order by oem_order_id.
    2. Update order: actual_delivery_date, status → "ready".
    3. Create a sales_handover DiarySlot.
    4. If order.pdi_planned is False: create a workshop_booking slot 3 working
       days before handover and insert a stub PDI WIP.
    """
    oem_order_id: str = payload["oem_order_id"]
    handover_dt: datetime = datetime.fromisoformat(payload["handover_datetime"])

    advisor_id: Optional[str] = payload.get("advisor_id")
    advisor_name: Optional[str] = payload.get("advisor_name")
    customer_id: Optional[str] = payload.get("customer_id")
    vehicle_registration: Optional[str] = payload.get("vehicle_registration")

    # 1. Locate the order
    order = await Order.find_one(
        Order.dealer_group_id == dealer_group_id,
        Order.oem_order_id == oem_order_id,
    )

    # 2. Update order if found
    if order:
        order.actual_delivery_date = handover_dt.date()
        if order.status not in ("delivered",):
            order.status = "ready"
        order.updated_at = datetime.utcnow()
        await order.save()

    # 3. Create sales_handover slot (1 hour default)
    handover_end = handover_dt + timedelta(hours=1)
    handover_slot = DiarySlot(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        slot_type="sales_handover",
        order_id=str(order.id) if order else None,
        customer_id=customer_id,
        vehicle_registration=vehicle_registration,
        start_time=handover_dt,
        end_time=handover_end,
        duration_minutes=60,
        assigned_to_id=advisor_id,
        assigned_to_name=advisor_name,
        assigned_to_type="advisor",
        status="booked",
        source="mqtt_sync",
    )
    await handover_slot.insert()

    # 4. Schedule PDI if not yet planned
    if order and not order.pdi_planned:
        pdi_start = _add_working_days(handover_dt, 3)
        pdi_start = pdi_start.replace(hour=8, minute=0, second=0, microsecond=0)
        pdi_end = pdi_start + timedelta(hours=2)

        pdi_slot = DiarySlot(
            dealer_group_id=dealer_group_id,
            outlet_id=outlet_id,
            slot_type="workshop_booking",
            order_id=str(order.id),
            vehicle_registration=vehicle_registration,
            start_time=pdi_start,
            end_time=pdi_end,
            duration_minutes=120,
            assigned_to_type="technician",
            status="booked",
            notes=f"PDI for order {oem_order_id}",
            source="mqtt_sync",
        )
        await pdi_slot.insert()

        # Create stub PDI WIP
        pdi_wip = WIP(
            dealer_group_id=dealer_group_id,
            outlet_id=outlet_id,
            oem_wip_id=f"PDI-{oem_order_id}",
            order_id=str(order.id),
            customer_id=customer_id,
            vehicle_registration=vehicle_registration,
            vehicle_make=order.ordered_model.split(" ")[0] if order else None,
            vehicle_model=order.ordered_model if order else None,
            job_type="pdi",
            booking_date=pdi_start,
            status="open",
            notes=f"Auto-created PDI for handover on {handover_dt.date()}",
        )
        await pdi_wip.insert()

        order.pdi_planned = True
        order.pdi_planned_date = pdi_start.date()
        order.pdi_wip_id = str(pdi_wip.id)
        order.updated_at = datetime.utcnow()
        await order.save()

        logger.info(
            "PDI slot and WIP created for order %s (handover %s)",
            oem_order_id,
            handover_dt.date(),
        )

    return handover_slot
