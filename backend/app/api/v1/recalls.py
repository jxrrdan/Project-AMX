from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.recall import RecallCampaign, RecallVehicle
from app.models.user import User
from app.services import recall_service

router = APIRouter(prefix="/recalls", tags=["recalls"])


class LogContactBody(BaseModel):
    method: str  # "phone" | "sms" | "email" | "letter"
    outcome: str  # "no_answer" | "left_message" | "spoke_to_customer" | "booked"
    notes: Optional[str] = None


class BookRecallBody(BaseModel):
    outlet_id: str
    booking_date: datetime


@router.get("/campaigns")
async def list_campaigns(
    brand_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List recall campaigns for this dealer group."""
    filters = [RecallCampaign.dealer_group_id == current_user.dealer_group_id]
    if brand_id:
        filters.append(RecallCampaign.brand_id == brand_id)
    if status:
        filters.append(RecallCampaign.status == status)

    return (
        await RecallCampaign.find(*filters)
        .sort(-RecallCampaign.received_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("/campaigns/{campaign_id}/identify-vehicles")
async def identify_vehicles(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Run vehicle identification for a recall campaign.
    Matches vehicles in the Vehicle collection against the campaign criteria
    and creates RecallVehicle records for new matches.
    """
    campaign = await RecallCampaign.get(campaign_id)
    if not campaign or campaign.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    try:
        count = await recall_service.identify_affected_vehicles(
            campaign_id=campaign_id,
            dealer_group_id=current_user.dealer_group_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"campaign_id": campaign_id, "newly_identified": count}


@router.get("/vehicles")
async def list_recall_vehicles(
    campaign_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """List recall vehicles, optionally filtered by campaign, status, or outlet."""
    filters = [RecallVehicle.dealer_group_id == current_user.dealer_group_id]
    if campaign_id:
        filters.append(RecallVehicle.campaign_id == campaign_id)
    if status:
        filters.append(RecallVehicle.status == status)
    if outlet_id:
        filters.append(RecallVehicle.outlet_id == outlet_id)

    return (
        await RecallVehicle.find(*filters)
        .sort(-RecallVehicle.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("/vehicles/{rv_id}/contact")
async def log_contact_attempt(
    rv_id: str,
    body: LogContactBody,
    current_user: User = Depends(get_current_user),
):
    """Log a contact attempt for a recall vehicle."""
    rv = await RecallVehicle.get(rv_id)
    if not rv or rv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Recall vehicle not found")

    try:
        rv = await recall_service.log_contact_attempt(
            recall_vehicle_id=rv_id,
            method=body.method,
            outcome=body.outcome,
            notes=body.notes,
            user_id=str(current_user.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return rv


@router.post("/vehicles/{rv_id}/book", status_code=201)
async def book_recall_vehicle(
    rv_id: str,
    body: BookRecallBody,
    current_user: User = Depends(get_current_user),
):
    """Book a recall vehicle in for repair, creating a WIP."""
    rv = await RecallVehicle.get(rv_id)
    if not rv or rv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Recall vehicle not found")

    try:
        rv, wip = await recall_service.book_recall(
            recall_vehicle_id=rv_id,
            booking_date=body.booking_date,
            dealer_group_id=current_user.dealer_group_id,
            outlet_id=body.outlet_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"recall_vehicle": rv, "wip_id": str(wip.id)}


@router.patch("/vehicles/{rv_id}/complete")
async def complete_recall_vehicle(
    rv_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark a recall vehicle as completed."""
    rv = await RecallVehicle.get(rv_id)
    if not rv or rv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Recall vehicle not found")

    rv.status = "completed"
    rv.completed_at = datetime.utcnow()
    rv.updated_at = datetime.utcnow()
    await rv.save()
    return rv


@router.patch("/vehicles/{rv_id}/not-applicable")
async def not_applicable_recall_vehicle(
    rv_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark a recall vehicle as not applicable for the campaign."""
    rv = await RecallVehicle.get(rv_id)
    if not rv or rv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Recall vehicle not found")

    rv.status = "not_applicable"
    rv.updated_at = datetime.utcnow()
    await rv.save()
    return rv
