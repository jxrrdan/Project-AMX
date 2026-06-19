from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.models.wip import WIP
from app.models.user import User
from app.services import wip_service

router = APIRouter(prefix="/wips", tags=["workshop"])


@router.get("")
async def list_wips(
    status: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    technician_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    filters = [WIP.dealer_group_id == current_user.dealer_group_id]
    if status:
        filters.append(WIP.status == status)
    if outlet_id:
        filters.append(WIP.outlet_id == outlet_id)
    if job_type:
        filters.append(WIP.job_type == job_type)
    if technician_id:
        filters.append(WIP.allocated_technician_id == technician_id)

    return await WIP.find(*filters).sort(-WIP.created_at).skip(skip).limit(limit).to_list()


@router.get("/{wip_id}")
async def get_wip(wip_id: str, current_user: User = Depends(get_current_user)):
    wip = await WIP.get(wip_id)
    if not wip or wip.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="WIP not found")
    return wip


@router.patch("/{wip_id}/status")
async def update_status(
    wip_id: str,
    new_status: str,
    current_user: User = Depends(get_current_user),
):
    valid = {"open", "in_progress", "awaiting_parts", "awaiting_authorisation", "ready", "invoiced"}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    wip = await WIP.get(wip_id)
    if not wip or wip.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="WIP not found")

    wip.status = new_status
    if new_status == "in_progress" and not wip.started_at:
        wip.started_at = datetime.utcnow()
    if new_status == "ready":
        wip.completed_at = datetime.utcnow()
    wip.updated_at = datetime.utcnow()
    await wip.save()
    return wip


@router.patch("/{wip_id}/allocate-technician")
async def allocate_technician(
    wip_id: str,
    technician_id: str,
    technician_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    wip = await WIP.get(wip_id)
    if not wip or wip.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="WIP not found")

    wip.allocated_technician_id = technician_id
    wip.allocated_technician_name = technician_name
    wip.updated_at = datetime.utcnow()
    await wip.save()
    return wip


@router.post("/{wip_id}/allocate-parts")
async def allocate_parts(wip_id: str, current_user: User = Depends(get_current_user)):
    try:
        shortages = await wip_service.allocate_parts_stock(wip_id, current_user.dealer_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {"shortages": shortages, "all_allocated": len(shortages) == 0}
