from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.technician import Technician, TimeEntry
from app.models.user import User
from app.services import technician_service

router = APIRouter(prefix="/technicians", tags=["technicians"])


class CreateTechnicianBody(BaseModel):
    outlet_id: str
    user_id: Optional[str] = None
    tech_code: str
    name: str
    grade: str = "technician"
    contracted_hours_per_day: float = 7.5
    labour_rate: float = 0.0
    cost_rate: float = 0.0
    specialisms: list[str] = []


class ClockOnBody(BaseModel):
    wip_id: Optional[str] = None
    op_code: Optional[str] = None
    clock_type: str = "on_job"


class ClockOffBody(BaseModel):
    notes: Optional[str] = None


@router.get("")
async def list_technicians(
    outlet_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """List active technicians, optionally filtered by outlet."""
    filters = [Technician.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(Technician.outlet_id == outlet_id)

    return await Technician.find(*filters).sort(Technician.name).to_list()


@router.post("", status_code=201)
async def create_technician(
    body: CreateTechnicianBody,
    current_user: User = Depends(get_current_user),
):
    """Create a new technician record."""
    tech = Technician(
        dealer_group_id=current_user.dealer_group_id,
        **body.model_dump(),
    )
    await tech.insert()
    return tech


@router.get("/{tech_id}/clock")
async def get_open_clock(
    tech_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the currently open time entry for a technician, if any."""
    tech = await Technician.get(tech_id)
    if not tech or tech.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Technician not found")

    entry = await TimeEntry.find_one(
        TimeEntry.dealer_group_id == current_user.dealer_group_id,
        TimeEntry.technician_id == tech_id,
        TimeEntry.is_open == True,
    )
    return entry  # May be None


@router.post("/{tech_id}/clock-on", status_code=201)
async def clock_on(
    tech_id: str,
    body: ClockOnBody,
    current_user: User = Depends(get_current_user),
):
    """Clock a technician on to a job (closes any open entry first)."""
    tech = await Technician.get(tech_id)
    if not tech or tech.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Technician not found")

    entry = await technician_service.clock_on(
        technician_id=tech_id,
        dealer_group_id=current_user.dealer_group_id,
        wip_id=body.wip_id,
        op_code=body.op_code,
        clock_type=body.clock_type,
    )
    return entry


@router.post("/{tech_id}/clock-off")
async def clock_off(
    tech_id: str,
    body: ClockOffBody,
    current_user: User = Depends(get_current_user),
):
    """Clock a technician off, closing the open time entry."""
    tech = await Technician.get(tech_id)
    if not tech or tech.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Technician not found")

    try:
        entry = await technician_service.clock_off(
            technician_id=tech_id,
            dealer_group_id=current_user.dealer_group_id,
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return entry


@router.get("/{tech_id}/time-entries")
async def list_time_entries(
    tech_id: str,
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """List time entries for a technician, optionally filtered by date range."""
    tech = await Technician.get(tech_id)
    if not tech or tech.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Technician not found")

    filters = [
        TimeEntry.dealer_group_id == current_user.dealer_group_id,
        TimeEntry.technician_id == tech_id,
    ]
    if from_date:
        filters.append(TimeEntry.started_at >= from_date)
    if to_date:
        filters.append(TimeEntry.started_at <= to_date)

    return (
        await TimeEntry.find(*filters)
        .sort(-TimeEntry.started_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.get("/{tech_id}/efficiency")
async def get_efficiency(
    tech_id: str,
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Return efficiency metrics for a technician over a date range."""
    tech = await Technician.get(tech_id)
    if not tech or tech.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Technician not found")

    try:
        return await technician_service.get_efficiency(
            technician_id=tech_id,
            dealer_group_id=current_user.dealer_group_id,
            from_dt=from_date,
            to_dt=to_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/loadsheet")
async def daily_loadsheet(
    outlet_id: Optional[str] = Query(None),
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Return the daily loadsheet for all active technicians in an outlet."""
    effective_outlet = outlet_id or (current_user.outlet_ids[0] if current_user.outlet_ids else None)
    if not effective_outlet:
        raise HTTPException(status_code=400, detail="outlet_id is required")

    effective_date = target_date or date.today()

    return await technician_service.get_daily_loadsheet(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=effective_outlet,
        target_date=effective_date,
    )
