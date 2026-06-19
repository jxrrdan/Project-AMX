from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.vhc import VHC, VHCItem, AuthorisationItem
from app.models.user import User

router = APIRouter(prefix="/vhcs", tags=["vhcs"])


class VHCItemIn(BaseModel):
    category: str
    item: str
    description: str
    condition: str = "not_checked"
    notes: Optional[str] = None
    image_urls: list[str] = []
    measurement: Optional[str] = None


class VHCIn(BaseModel):
    outlet_id: str
    wip_id: Optional[str] = None
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    technician_id: Optional[str] = None
    technician_name: Optional[str] = None
    vehicle_mileage: Optional[int] = None
    vehicle_registration: Optional[str] = None
    items: list[VHCItemIn] = []


def _compute_counts(items: list[VHCItem]) -> tuple[int, int, int]:
    passes = sum(1 for i in items if i.condition == "pass")
    advisories = sum(1 for i in items if i.condition == "advisory")
    fails = sum(1 for i in items if i.condition == "fail")
    return passes, advisories, fails


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_vhc(body: VHCIn, current_user: User = Depends(get_current_user)):
    items = [VHCItem(**i.model_dump()) for i in body.items]
    passes, advisories, fails = _compute_counts(items)

    vhc = VHC(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=body.outlet_id,
        wip_id=body.wip_id,
        customer_id=body.customer_id,
        vehicle_id=body.vehicle_id,
        technician_id=body.technician_id,
        technician_name=body.technician_name,
        vehicle_mileage=body.vehicle_mileage,
        vehicle_registration=body.vehicle_registration,
        items=items,
        pass_count=passes,
        advisory_count=advisories,
        fail_count=fails,
        requires_authorisation=fails > 0 or advisories > 0,
        status="draft",
    )
    await vhc.insert()
    return vhc


@router.get("/{vhc_id}")
async def get_vhc(vhc_id: str, current_user: User = Depends(get_current_user)):
    vhc = await VHC.get(vhc_id)
    if not vhc or vhc.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="VHC not found")
    return vhc


@router.patch("/{vhc_id}/items")
async def update_items(
    vhc_id: str,
    items: list[VHCItemIn],
    current_user: User = Depends(get_current_user),
):
    vhc = await VHC.get(vhc_id)
    if not vhc or vhc.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="VHC not found")

    vhc.items = [VHCItem(**i.model_dump()) for i in items]
    vhc.pass_count, vhc.advisory_count, vhc.fail_count = _compute_counts(vhc.items)
    vhc.requires_authorisation = vhc.fail_count > 0 or vhc.advisory_count > 0
    vhc.updated_at = datetime.utcnow()
    if vhc.status == "draft":
        vhc.status = "in_progress"
    await vhc.save()
    return vhc


@router.post("/{vhc_id}/request-authorisation")
async def request_authorisation(
    vhc_id: str,
    method: str = "email",
    current_user: User = Depends(get_current_user),
):
    vhc = await VHC.get(vhc_id)
    if not vhc or vhc.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="VHC not found")

    vhc.status = "awaiting_authorisation"
    vhc.authorisation_requested_at = datetime.utcnow()
    vhc.authorisation_method = method
    vhc.updated_at = datetime.utcnow()
    await vhc.save()
    return vhc


@router.post("/{vhc_id}/authorise")
async def authorise(
    vhc_id: str,
    authorised_by: str,
    current_user: User = Depends(get_current_user),
):
    vhc = await VHC.get(vhc_id)
    if not vhc or vhc.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="VHC not found")

    vhc.status = "authorised"
    vhc.authorised_at = datetime.utcnow()
    vhc.authorised_by = authorised_by
    vhc.updated_at = datetime.utcnow()
    await vhc.save()
    return vhc


@router.get("")
async def list_vhcs(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    filters = [VHC.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(VHC.outlet_id == outlet_id)
    if status:
        filters.append(VHC.status == status)
    return await VHC.find(*filters).sort(-VHC.created_at).limit(100).to_list()
