from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.order import Order
from app.models.user import User
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])


class PlanPDIRequest(BaseModel):
    planned_date: date


@router.get("")
async def list_orders(
    status: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    filters = [Order.dealer_group_id == current_user.dealer_group_id]
    if status:
        filters.append(Order.status == status)
    if outlet_id:
        filters.append(Order.outlet_id == outlet_id)
    return await Order.find(*filters).sort(-Order.received_at).skip(skip).limit(limit).to_list()


@router.get("/{order_id}")
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    order = await Order.get(order_id)
    if not order or order.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/plan-pdi")
async def plan_pdi(
    order_id: str,
    body: PlanPDIRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        order = await order_service.plan_pdi(order_id, body.planned_date, current_user.dealer_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return order


@router.post("/{order_id}/mark-accessories-invoiced")
async def mark_accessories_invoiced(
    order_id: str,
    invoice_ref: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime

    order = await Order.get(order_id)
    if not order or order.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Order not found")

    order.accessories_invoiced = True
    order.accessories_invoice_date = datetime.utcnow()
    order.accessories_invoice_ref = invoice_ref
    if order.status == "received":
        order.status = "accessories_invoiced"
    order.updated_at = datetime.utcnow()
    await order.save()
    return order
