from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.used_vehicle import UsedVehicle, Appraisal, PrepCost, AppraiserNote
from app.models.user import User

router = APIRouter(prefix="/used-vehicles", tags=["used-vehicles"])


# ---------------------------------------------------------------------------
# PO number generation helper
# ---------------------------------------------------------------------------

async def _next_stock_number(dealer_group_id: str, outlet_id: str) -> str:
    """Generate stock number: {outlet_code}-UV-{NNNNNN}"""
    last = await UsedVehicle.find(
        UsedVehicle.dealer_group_id == dealer_group_id,
        UsedVehicle.outlet_id == outlet_id,
    ).sort(-UsedVehicle.created_at).first_or_none()

    seq = 1
    if last and last.stock_number:
        try:
            seq = int(last.stock_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            pass

    return f"{outlet_id.upper()}-UV-{seq:06d}"


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CreateUsedVehicleBody(BaseModel):
    outlet_id: str
    vehicle_id: str
    acquisition_type: str
    acquisition_date: datetime
    acquisition_cost: float
    asking_price: float
    cap_clean: Optional[float] = None
    cap_average: Optional[float] = None
    minimum_price: Optional[float] = None
    gross_profit_target: float = 0.0


class UpdateUsedVehicleBody(BaseModel):
    asking_price: Optional[float] = None
    status: Optional[str] = None
    advertised_online: Optional[bool] = None
    minimum_price: Optional[float] = None
    gross_profit_target: Optional[float] = None


class AddPrepCostBody(BaseModel):
    description: str
    cost: float
    supplier_id: Optional[str] = None


class CreateAppraisalBody(BaseModel):
    outlet_id: str
    registration: str
    make: str
    model: str
    derivative: Optional[str] = None
    mileage: int
    colour: Optional[str] = None
    fuel_type: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    bodywork_grade: str = "good"
    mechanical_grade: str = "good"
    interior_grade: str = "good"
    tyre_condition: str = "good"
    service_history: str = "full"
    mot_months_remaining: Optional[int] = None
    notes: Optional[str] = None
    cap_clean: Optional[float] = None
    cap_average: Optional[float] = None
    trade_value: Optional[float] = None
    offered_price: Optional[float] = None
    customer_id: Optional[str] = None
    order_id: Optional[str] = None


class UpdateAppraisalBody(BaseModel):
    offered_price: Optional[float] = None
    accepted_price: Optional[float] = None
    status: Optional[str] = None
    trade_value: Optional[float] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Used vehicle stock endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_stock(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List used vehicle stock, optionally filtered by outlet and status."""
    filters = [UsedVehicle.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(UsedVehicle.outlet_id == outlet_id)
    if status:
        filters.append(UsedVehicle.status == status)

    return (
        await UsedVehicle.find(*filters)
        .sort(-UsedVehicle.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("", status_code=201)
async def create_stock_record(
    body: CreateUsedVehicleBody,
    current_user: User = Depends(get_current_user),
):
    """Create a new used vehicle stock record."""
    stock_number = await _next_stock_number(current_user.dealer_group_id, body.outlet_id)
    total_investment = body.acquisition_cost  # No prep costs yet

    uv = UsedVehicle(
        dealer_group_id=current_user.dealer_group_id,
        stock_number=stock_number,
        total_investment=total_investment,
        **body.model_dump(),
    )
    await uv.insert()
    return uv


@router.get("/{stock_id}")
async def get_stock_record(
    stock_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve a used vehicle stock record by ID."""
    uv = await UsedVehicle.get(stock_id)
    if not uv or uv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Used vehicle not found")
    return uv


@router.patch("/{stock_id}")
async def update_stock_record(
    stock_id: str,
    body: UpdateUsedVehicleBody,
    current_user: User = Depends(get_current_user),
):
    """Update asking price, status, or advertised_online flag."""
    uv = await UsedVehicle.get(stock_id)
    if not uv or uv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Used vehicle not found")

    if body.asking_price is not None:
        uv.asking_price = body.asking_price
    if body.status is not None:
        uv.status = body.status
        if body.status == "sold" and not uv.sold_at:
            uv.sold_at = datetime.utcnow()
    if body.advertised_online is not None:
        uv.advertised_online = body.advertised_online
    if body.minimum_price is not None:
        uv.minimum_price = body.minimum_price
    if body.gross_profit_target is not None:
        uv.gross_profit_target = body.gross_profit_target

    uv.updated_at = datetime.utcnow()
    await uv.save()
    return uv


@router.post("/{stock_id}/prep-cost", status_code=201)
async def add_prep_cost(
    stock_id: str,
    body: AddPrepCostBody,
    current_user: User = Depends(get_current_user),
):
    """Add a prep cost to a used vehicle stock record."""
    uv = await UsedVehicle.get(stock_id)
    if not uv or uv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Used vehicle not found")

    cost = PrepCost(
        description=body.description,
        cost=body.cost,
        supplier_id=body.supplier_id,
        completed=False,
    )
    uv.prep_costs.append(cost)
    uv.total_prep_cost = round(sum(c.cost for c in uv.prep_costs), 2)
    uv.total_investment = round(uv.acquisition_cost + uv.total_prep_cost, 2)
    uv.updated_at = datetime.utcnow()
    await uv.save()
    return uv


@router.patch("/{stock_id}/prep-cost/{index}/complete")
async def complete_prep_cost(
    stock_id: str,
    index: int,
    current_user: User = Depends(get_current_user),
):
    """Mark a specific prep cost line as complete."""
    uv = await UsedVehicle.get(stock_id)
    if not uv or uv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Used vehicle not found")

    if index < 0 or index >= len(uv.prep_costs):
        raise HTTPException(status_code=400, detail="Prep cost index out of range")

    uv.prep_costs[index].completed = True
    uv.prep_costs[index].completed_at = datetime.utcnow()
    uv.prep_complete = all(c.completed for c in uv.prep_costs)
    uv.updated_at = datetime.utcnow()
    await uv.save()
    return uv


# ---------------------------------------------------------------------------
# Appraisal endpoints
# ---------------------------------------------------------------------------

@router.get("/appraisals")
async def list_appraisals(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List vehicle appraisals."""
    filters = [Appraisal.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(Appraisal.outlet_id == outlet_id)
    if status:
        filters.append(Appraisal.status == status)

    return (
        await Appraisal.find(*filters)
        .sort(-Appraisal.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("/appraisals", status_code=201)
async def create_appraisal(
    body: CreateAppraisalBody,
    current_user: User = Depends(get_current_user),
):
    """Create a new vehicle appraisal."""
    appraisal = Appraisal(
        dealer_group_id=current_user.dealer_group_id,
        appraised_by=str(current_user.id),
        status="pending",
        **body.model_dump(),
    )
    await appraisal.insert()
    return appraisal


@router.get("/appraisals/{appraisal_id}")
async def get_appraisal(
    appraisal_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve an appraisal by ID."""
    ap = await Appraisal.get(appraisal_id)
    if not ap or ap.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    return ap


@router.patch("/appraisals/{appraisal_id}")
async def update_appraisal(
    appraisal_id: str,
    body: UpdateAppraisalBody,
    current_user: User = Depends(get_current_user),
):
    """Update offer price, acceptance status, or notes on an appraisal."""
    ap = await Appraisal.get(appraisal_id)
    if not ap or ap.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Appraisal not found")

    if body.offered_price is not None:
        ap.offered_price = body.offered_price
    if body.accepted_price is not None:
        ap.accepted_price = body.accepted_price
    if body.status is not None:
        ap.status = body.status
    if body.trade_value is not None:
        ap.trade_value = body.trade_value
    if body.notes is not None:
        ap.notes = body.notes

    ap.updated_at = datetime.utcnow()
    await ap.save()
    return ap
