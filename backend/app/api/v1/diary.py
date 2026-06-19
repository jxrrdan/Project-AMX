from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.diary import DiarySlot
from app.models.user import User
from app.services import diary_service

router = APIRouter(prefix="/diary", tags=["diary"])

VALID_STATUSES = {"booked", "arrived", "in_progress", "complete", "cancelled", "no_show"}


class CreateSlotBody(BaseModel):
    outlet_id: str
    slot_type: str = "workshop_booking"
    start_time: datetime
    end_time: datetime
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_to_type: str = "technician"
    wip_id: Optional[str] = None
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_registration: Optional[str] = None
    customer_name: Optional[str] = None
    bay: Optional[str] = None
    transport_type: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_slots(
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    outlet_id: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    slot_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """List diary slots within a date range for an outlet."""
    effective_outlet = outlet_id or (current_user.outlet_ids[0] if current_user.outlet_ids else None)
    if not effective_outlet:
        raise HTTPException(status_code=400, detail="outlet_id is required")

    return await diary_service.get_slots_for_date_range(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
        from_dt=from_date,
        to_dt=to_date,
        assigned_to_id=assigned_to_id,
        slot_type=slot_type,
    )


@router.post("", status_code=201)
async def create_slot(
    body: CreateSlotBody,
    current_user: User = Depends(get_current_user),
):
    """Create a new diary slot, validating technician availability."""
    try:
        slot = await diary_service.create_booking(
            dealer_group_id=current_user.dealer_group_id,
            outlet_id=body.outlet_id,
            data=body.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return slot


@router.patch("/{slot_id}/status")
async def update_slot_status(
    slot_id: str,
    new_status: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Update the status of a diary slot."""
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {sorted(VALID_STATUSES)}",
        )

    slot = await DiarySlot.get(slot_id)
    if not slot or slot.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Diary slot not found")

    slot.status = new_status
    slot.updated_at = datetime.utcnow()
    await slot.save()
    return slot


@router.delete("/{slot_id}", status_code=200)
async def cancel_slot(
    slot_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a diary slot (sets status to cancelled)."""
    slot = await DiarySlot.get(slot_id)
    if not slot or slot.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Diary slot not found")

    slot.status = "cancelled"
    slot.updated_at = datetime.utcnow()
    await slot.save()
    return {"id": slot_id, "status": "cancelled"}
