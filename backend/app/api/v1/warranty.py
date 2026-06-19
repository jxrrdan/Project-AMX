from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.warranty import WarrantyClaim, WarrantyLine
from app.models.wip import WIP
from app.models.user import User

router = APIRouter(prefix="/warranty", tags=["warranty"])


class WarrantyLineBody(BaseModel):
    line_type: str  # "labour" | "parts" | "sublet"
    op_code: Optional[str] = None
    description: str
    quantity: float
    unit_amount: float
    claimed_amount: float


class CreateWarrantyClaimBody(BaseModel):
    wip_id: str
    brand_id: str
    failure_description: str
    cause_description: Optional[str] = None
    correction_description: Optional[str] = None
    auth_code: Optional[str] = None
    lines: list[WarrantyLineBody] = []


class SettleClaimBody(BaseModel):
    labour_settled: float = 0.0
    parts_settled: float = 0.0
    sublet_settled: float = 0.0
    settlement_reference: str


class RejectClaimBody(BaseModel):
    rejection_reason: str


@router.get("")
async def list_claims(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List warranty claims with optional filters."""
    filters = [WarrantyClaim.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(WarrantyClaim.outlet_id == outlet_id)
    if status:
        filters.append(WarrantyClaim.status == status)
    if brand_id:
        filters.append(WarrantyClaim.brand_id == brand_id)

    return (
        await WarrantyClaim.find(*filters)
        .sort(-WarrantyClaim.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("", status_code=201)
async def create_claim(
    body: CreateWarrantyClaimBody,
    current_user: User = Depends(get_current_user),
):
    """Create a warranty claim from a WIP."""
    wip = await WIP.get(body.wip_id)
    if not wip or wip.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="WIP not found")

    lines = [WarrantyLine(**ln.model_dump()) for ln in body.lines]

    labour_claimed = round(
        sum(ln.claimed_amount for ln in lines if ln.line_type == "labour"), 2
    )
    parts_claimed = round(
        sum(ln.claimed_amount for ln in lines if ln.line_type == "parts"), 2
    )
    sublet_claimed = round(
        sum(ln.claimed_amount for ln in lines if ln.line_type == "sublet"), 2
    )
    total_claimed = round(labour_claimed + parts_claimed + sublet_claimed, 2)

    claim = WarrantyClaim(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=wip.outlet_id,
        wip_id=str(wip.id),
        brand_id=body.brand_id,
        vehicle_vin=wip.vehicle_vin or "",
        vehicle_registration=wip.vehicle_registration,
        vehicle_mileage=wip.vehicle_mileage_in or 0,
        failure_description=body.failure_description,
        cause_description=body.cause_description,
        correction_description=body.correction_description,
        auth_code=body.auth_code,
        lines=lines,
        labour_claimed=labour_claimed,
        parts_claimed=parts_claimed,
        sublet_claimed=sublet_claimed,
        total_claimed=total_claimed,
        status="draft",
        created_by=str(current_user.id),
    )
    await claim.insert()
    return claim


@router.get("/{claim_id}")
async def get_claim(
    claim_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve a warranty claim by ID."""
    claim = await WarrantyClaim.get(claim_id)
    if not claim or claim.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Warranty claim not found")
    return claim


@router.patch("/{claim_id}/submit")
async def submit_claim(
    claim_id: str,
    oem_claim_reference: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Submit a warranty claim to the OEM (status → submitted)."""
    claim = await WarrantyClaim.get(claim_id)
    if not claim or claim.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Warranty claim not found")
    if claim.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft claims can be submitted")

    claim.status = "submitted"
    claim.submitted_at = datetime.utcnow()
    if oem_claim_reference:
        claim.oem_claim_reference = oem_claim_reference
    claim.updated_at = datetime.utcnow()
    await claim.save()
    return claim


@router.patch("/{claim_id}/settle")
async def settle_claim(
    claim_id: str,
    body: SettleClaimBody,
    current_user: User = Depends(get_current_user),
):
    """Record OEM settlement of a warranty claim."""
    claim = await WarrantyClaim.get(claim_id)
    if not claim or claim.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Warranty claim not found")
    if claim.status not in ("submitted", "approved", "queried"):
        raise HTTPException(status_code=400, detail="Claim cannot be settled in its current status")

    claim.labour_settled = body.labour_settled
    claim.parts_settled = body.parts_settled
    claim.sublet_settled = body.sublet_settled
    claim.total_settled = round(
        body.labour_settled + body.parts_settled + body.sublet_settled, 2
    )
    claim.settlement_reference = body.settlement_reference
    claim.status = "settled"
    claim.settled_at = datetime.utcnow()
    claim.updated_at = datetime.utcnow()
    await claim.save()

    variance = round(claim.total_claimed - claim.total_settled, 2)
    return {
        "claim": claim,
        "variance": variance,
        "fully_settled": variance == 0.0,
    }


@router.patch("/{claim_id}/reject")
async def reject_claim(
    claim_id: str,
    body: RejectClaimBody,
    current_user: User = Depends(get_current_user),
):
    """Record OEM rejection of a warranty claim."""
    claim = await WarrantyClaim.get(claim_id)
    if not claim or claim.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Warranty claim not found")

    claim.status = "rejected"
    claim.rejection_reason = body.rejection_reason
    claim.updated_at = datetime.utcnow()
    await claim.save()
    return claim
