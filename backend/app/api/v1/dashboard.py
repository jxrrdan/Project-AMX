from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.order import Order
from app.models.wip import WIP
from app.models.vhc import VHC
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(current_user: User = Depends(get_current_user)):
    dg = current_user.dealer_group_id

    orders_by_status = {}
    for s in ["received", "accessories_invoiced", "pdi_booked", "pdi_complete", "ready", "delivered"]:
        orders_by_status[s] = await Order.find(
            Order.dealer_group_id == dg, Order.status == s
        ).count()

    wips_by_status = {}
    for s in ["open", "in_progress", "awaiting_parts", "awaiting_authorisation", "ready", "invoiced"]:
        wips_by_status[s] = await WIP.find(
            WIP.dealer_group_id == dg, WIP.status == s
        ).count()

    vhcs_awaiting = await VHC.find(
        VHC.dealer_group_id == dg, VHC.status == "awaiting_authorisation"
    ).count()

    return {
        "orders": orders_by_status,
        "wips": wips_by_status,
        "vhcs_awaiting_authorisation": vhcs_awaiting,
    }
