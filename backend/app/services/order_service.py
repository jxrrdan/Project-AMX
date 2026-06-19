from datetime import datetime, date
from app.models.order import Order, AccessoryLine
from app.models.wip import WIP
from app.services import customer_service


async def upsert_from_mqtt(
    dealer_group_id: str,
    outlet_id: str,
    payload: dict,
) -> tuple[Order, bool]:
    """
    Upsert a signed order arriving via MQTT.
    Returns (order, was_created).
    """
    oem_order_id = payload["oem_order_id"]

    existing = await Order.find_one(
        Order.dealer_group_id == dealer_group_id,
        Order.oem_order_id == oem_order_id,
    )

    accessory_lines = [
        AccessoryLine(**line) for line in payload.get("accessory_lines", [])
    ]
    accessories_total = sum(line.total_price for line in accessory_lines)

    order_date_raw = payload.get("order_date")
    order_date = (
        datetime.fromisoformat(order_date_raw) if order_date_raw else datetime.utcnow()
    )

    expected_delivery_raw = payload.get("expected_delivery_date")
    expected_delivery = (
        date.fromisoformat(expected_delivery_raw) if expected_delivery_raw else None
    )

    # Attempt to resolve customer
    customer_id = None
    mfr_customer_id = payload.get("manufacturer_customer_id")
    brand_id = payload.get("brand_id", "")
    if mfr_customer_id and brand_id:
        customer = await customer_service.find_by_manufacturer_id(
            dealer_group_id, brand_id, mfr_customer_id
        )
        if customer:
            customer_id = str(customer.id)

    if existing:
        existing.accessory_lines = accessory_lines
        existing.accessories_total = accessories_total
        existing.customer_id = customer_id or existing.customer_id
        existing.ordered_model = payload.get("ordered_model", existing.ordered_model)
        existing.expected_delivery_date = expected_delivery or existing.expected_delivery_date
        existing.updated_at = datetime.utcnow()
        await existing.save()
        return existing, False

    order = Order(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        oem_order_id=oem_order_id,
        oem_order_ref=payload.get("oem_order_ref"),
        brand_id=brand_id,
        customer_id=customer_id,
        manufacturer_customer_id=mfr_customer_id,
        ordered_vin=payload.get("ordered_vin"),
        ordered_model=payload.get("ordered_model", "Unknown"),
        ordered_derivative=payload.get("ordered_derivative"),
        ordered_colour=payload.get("ordered_colour"),
        ordered_interior_colour=payload.get("ordered_interior_colour"),
        accessory_lines=accessory_lines,
        accessories_total=accessories_total,
        order_date=order_date,
        expected_delivery_date=expected_delivery,
        raw_payload=payload,
    )
    await order.insert()
    return order, True


async def plan_pdi(order_id: str, planned_date: date, dealer_group_id: str) -> Order:
    order = await Order.get(order_id)
    if not order or order.dealer_group_id != dealer_group_id:
        raise ValueError("Order not found")

    # Create a stub WIP for the PDI — the OEM system will later push the full WIP
    wip = WIP(
        dealer_group_id=dealer_group_id,
        outlet_id=order.outlet_id,
        oem_wip_id=f"PDI-{order.oem_order_id}",
        oem_wip_ref=f"PDI for {order.oem_order_ref or order.oem_order_id}",
        brand_id=order.brand_id,
        customer_id=order.customer_id,
        job_type="pdi",
        status="open",
        booking_date=datetime.combine(planned_date, datetime.min.time()),
        promised_date=datetime.combine(planned_date, datetime.min.time()),
        ordered_vin=order.ordered_vin,
        notes=f"PDI for order {order.oem_order_ref or order.oem_order_id}",
    )
    await wip.insert()

    order.pdi_planned = True
    order.pdi_planned_date = planned_date
    order.pdi_wip_id = str(wip.id)
    order.status = "pdi_booked"
    order.updated_at = datetime.utcnow()
    await order.save()
    return order
