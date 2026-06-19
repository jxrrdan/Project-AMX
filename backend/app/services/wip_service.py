from datetime import datetime
from app.models.wip import WIP, LabourLine, PartsLine
from app.models.parts import StockLevel, StockTransaction
from app.services import customer_service


async def upsert_from_mqtt(
    dealer_group_id: str,
    outlet_id: str,
    payload: dict,
) -> tuple[WIP, bool]:
    """
    Create or update a WIP from an OEM MQTT push.
    The OEM creates WIPs with labour and parts lines pre-populated.
    """
    oem_wip_id = payload["oem_wip_id"]

    existing = await WIP.find_one(
        WIP.dealer_group_id == dealer_group_id,
        WIP.oem_wip_id == oem_wip_id,
    )

    labour_lines = [LabourLine(**l) for l in payload.get("labour_lines", [])]
    parts_lines = [PartsLine(**p) for p in payload.get("parts_lines", [])]

    labour_total = sum(l.total for l in labour_lines)
    parts_total = sum(p.total_price for p in parts_lines)

    # Resolve customer
    customer_id = None
    mfr_id = payload.get("manufacturer_customer_id")
    brand_id = payload.get("brand_id", "")
    if mfr_id and brand_id:
        customer = await customer_service.find_by_manufacturer_id(dealer_group_id, brand_id, mfr_id)
        if customer:
            customer_id = str(customer.id)

    if existing:
        existing.labour_lines = labour_lines
        existing.parts_lines = parts_lines
        existing.labour_total = labour_total
        existing.parts_total = parts_total
        existing.total = labour_total + parts_total
        existing.customer_id = customer_id or existing.customer_id
        existing.updated_at = datetime.utcnow()
        await existing.save()
        return existing, False

    booking_raw = payload.get("booking_date")
    promised_raw = payload.get("promised_date")

    wip = WIP(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        oem_wip_id=oem_wip_id,
        oem_wip_ref=payload.get("oem_wip_ref"),
        brand_id=brand_id,
        customer_id=customer_id,
        manufacturer_customer_id=mfr_id,
        vehicle_vin=payload.get("vehicle_vin"),
        vehicle_registration=payload.get("vehicle_registration"),
        vehicle_make=payload.get("vehicle_make"),
        vehicle_model=payload.get("vehicle_model"),
        vehicle_mileage_in=payload.get("vehicle_mileage_in"),
        job_type=payload.get("job_type", "repair"),
        labour_lines=labour_lines,
        parts_lines=parts_lines,
        labour_total=labour_total,
        parts_total=parts_total,
        total=labour_total + parts_total,
        booking_date=datetime.fromisoformat(booking_raw) if booking_raw else None,
        promised_date=datetime.fromisoformat(promised_raw) if promised_raw else None,
        vhc_required=payload.get("vhc_required", False),
        raw_payload=payload,
    )
    await wip.insert()
    return wip, True


async def allocate_parts_stock(wip_id: str, dealer_group_id: str) -> list[str]:
    """
    Allocate stock for all required parts lines on a WIP.
    Returns a list of part numbers that could not be fully allocated.
    """
    wip = await WIP.get(wip_id)
    if not wip or wip.dealer_group_id != dealer_group_id:
        raise ValueError("WIP not found")

    shortages: list[str] = []

    for line in wip.parts_lines:
        if line.status != "required":
            continue

        stock = await StockLevel.find_one(
            StockLevel.dealer_group_id == dealer_group_id,
            StockLevel.outlet_id == wip.outlet_id,
            StockLevel.part_number == line.part_number,
        )

        if not stock or stock.quantity_available < line.quantity:
            shortages.append(line.part_number)
            continue

        stock.quantity_allocated += line.quantity
        stock.quantity_available = stock.quantity_on_hand - stock.quantity_allocated
        stock.updated_at = datetime.utcnow()
        await stock.save()

        await StockTransaction(
            dealer_group_id=dealer_group_id,
            outlet_id=wip.outlet_id,
            part_id=stock.part_id,
            part_number=line.part_number,
            transaction_type="issue",
            quantity=-line.quantity,
            unit_cost=line.unit_price,
            reference_type="wip",
            reference_id=str(wip.id),
        ).insert()

        line.status = "picking"

    wip.updated_at = datetime.utcnow()
    await wip.save()
    return shortages
