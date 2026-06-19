from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.parts import Part, StockLevel, StockTransaction
from app.models.user import User

router = APIRouter(prefix="/parts", tags=["parts"])


class PartIn(BaseModel):
    part_number: str
    description: str
    brand_id: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    unit_cost: float = 0.0
    unit_sell: float = 0.0


class StockAdjustmentIn(BaseModel):
    outlet_id: str
    quantity: int
    transaction_type: str = "adjustment"
    notes: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None


@router.get("")
async def list_parts(
    q: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    filters = [Part.dealer_group_id == current_user.dealer_group_id, Part.is_active == True]
    if brand_id:
        filters.append(Part.brand_id == brand_id)
    if category:
        filters.append(Part.category == category)

    parts = await Part.find(*filters).skip(skip).limit(limit).to_list()

    if q:
        q_lower = q.lower()
        parts = [
            p for p in parts
            if q_lower in p.part_number.lower() or q_lower in p.description.lower()
        ]
    return parts


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_part(body: PartIn, current_user: User = Depends(get_current_user)):
    part = Part(
        dealer_group_id=current_user.dealer_group_id,
        **body.model_dump(),
    )
    await part.insert()
    return part


@router.get("/stock")
async def list_stock(
    outlet_id: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    filters = [StockLevel.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(StockLevel.outlet_id == outlet_id)

    levels = await StockLevel.find(*filters).to_list()

    if low_stock_only:
        levels = [s for s in levels if s.quantity_available <= s.reorder_point]

    return levels


@router.post("/stock/{part_number}/adjust")
async def adjust_stock(
    part_number: str,
    body: StockAdjustmentIn,
    current_user: User = Depends(get_current_user),
):
    part = await Part.find_one(
        Part.dealer_group_id == current_user.dealer_group_id,
        Part.part_number == part_number,
    )
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")

    stock = await StockLevel.find_one(
        StockLevel.dealer_group_id == current_user.dealer_group_id,
        StockLevel.outlet_id == body.outlet_id,
        StockLevel.part_number == part_number,
    )

    if not stock:
        stock = StockLevel(
            dealer_group_id=current_user.dealer_group_id,
            outlet_id=body.outlet_id,
            part_id=str(part.id),
            part_number=part_number,
        )

    stock.quantity_on_hand = max(0, stock.quantity_on_hand + body.quantity)
    stock.quantity_available = max(0, stock.quantity_on_hand - stock.quantity_allocated)
    stock.updated_at = datetime.utcnow()
    await stock.save()

    await StockTransaction(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=body.outlet_id,
        part_id=str(part.id),
        part_number=part_number,
        transaction_type=body.transaction_type,
        quantity=body.quantity,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        notes=body.notes,
        created_by=str(current_user.id),
    ).insert()

    return stock
