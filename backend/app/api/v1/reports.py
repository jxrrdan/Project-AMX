from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import reporting_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _require_outlet(outlet_id: Optional[str], user: User) -> str:
    effective = outlet_id or (user.outlet_ids[0] if user.outlet_ids else None)
    if not effective:
        raise HTTPException(status_code=400, detail="outlet_id is required")
    return effective


@router.get("/workshop-efficiency")
async def workshop_efficiency(
    outlet_id: Optional[str] = Query(None),
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    Per-technician efficiency report.
    Returns hours_attended, hours_sold, and efficiency_pct for each active technician.
    """
    effective_outlet = _require_outlet(outlet_id, current_user)
    return await reporting_service.workshop_efficiency(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
        from_dt=from_date,
        to_dt=to_date,
    )


@router.get("/revenue-by-type")
async def revenue_by_type(
    outlet_id: Optional[str] = Query(None),
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    Revenue summary grouped by invoice type (workshop, new_vehicle, parts, etc.).
    Includes count, net, tax and gross totals per type.
    """
    effective_outlet = _require_outlet(outlet_id, current_user)
    return await reporting_service.revenue_by_type(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
        from_dt=from_date,
        to_dt=to_date,
    )


@router.get("/parts-margin")
async def parts_margin(
    outlet_id: Optional[str] = Query(None),
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    Parts margin report derived from stock issue transactions and part sell prices.
    Returns cost, revenue, margin_amount, and margin_pct.
    """
    effective_outlet = _require_outlet(outlet_id, current_user)
    return await reporting_service.parts_margin(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
        from_dt=from_date,
        to_dt=to_date,
    )


@router.get("/vhc-conversion")
async def vhc_conversion(
    outlet_id: Optional[str] = Query(None),
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    VHC authorisation conversion rate — of those requiring authorisation,
    how many were authorised vs declined.
    """
    effective_outlet = _require_outlet(outlet_id, current_user)
    return await reporting_service.vhc_conversion(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
        from_dt=from_date,
        to_dt=to_date,
    )


@router.get("/aged-debtors")
async def aged_debtors(
    outlet_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Aged debtor analysis — posted (unpaid) invoices grouped into 0-30, 31-60,
    61-90, and 90+ day buckets.
    """
    effective_outlet = _require_outlet(outlet_id, current_user)
    return await reporting_service.aged_debtors(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
    )
