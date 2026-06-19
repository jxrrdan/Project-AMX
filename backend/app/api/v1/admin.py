from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import require_admin
from app.core.security import hash_password
from app.models.user import User
from app.models.outlet import Outlet
from app.models.mqtt_event import MqttEvent

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CreateUserBody(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "advisor"
    outlet_ids: list[str] = []


class UpdateUserBody(BaseModel):
    role: Optional[str] = None
    outlet_ids: Optional[list[str]] = None
    is_active: Optional[bool] = None


class CreateOutletBody(BaseModel):
    outlet_code: str
    name: str
    brand_ids: list[str] = []
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: str = "GB"
    phone: Optional[str] = None
    email: Optional[str] = None


class UpdateOutletBody(BaseModel):
    name: Optional[str] = None
    brand_ids: Optional[list[str]] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    current_user: User = Depends(require_admin),
):
    """List all users in the dealer group."""
    return await User.find(
        User.dealer_group_id == current_user.dealer_group_id,
    ).sort(User.last_name).to_list()


@router.post("/users", status_code=201)
async def create_user(
    body: CreateUserBody,
    current_user: User = Depends(require_admin),
):
    """Create a new user account."""
    existing = await User.find_one(
        User.dealer_group_id == current_user.dealer_group_id,
        User.email == body.email.lower().strip(),
    )
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = User(
        dealer_group_id=current_user.dealer_group_id,
        email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
        outlet_ids=body.outlet_ids,
    )
    await user.insert()
    # Never return the hashed_password in responses
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "outlet_ids": user.outlet_ids,
        "is_active": user.is_active,
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserBody,
    current_user: User = Depends(require_admin),
):
    """Update a user's role, outlet access, or active status."""
    user = await User.get(user_id)
    if not user or user.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        user.role = body.role
    if body.outlet_ids is not None:
        user.outlet_ids = body.outlet_ids
    if body.is_active is not None:
        user.is_active = body.is_active

    user.updated_at = datetime.utcnow()
    await user.save()
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "outlet_ids": user.outlet_ids,
        "is_active": user.is_active,
    }


# ---------------------------------------------------------------------------
# Outlet management
# ---------------------------------------------------------------------------

@router.get("/outlets")
async def list_outlets(
    current_user: User = Depends(require_admin),
):
    """List all outlets for this dealer group."""
    return await Outlet.find(
        Outlet.dealer_group_id == current_user.dealer_group_id,
    ).sort(Outlet.name).to_list()


@router.post("/outlets", status_code=201)
async def create_outlet(
    body: CreateOutletBody,
    current_user: User = Depends(require_admin),
):
    """Create a new outlet."""
    outlet = Outlet(
        dealer_group_id=current_user.dealer_group_id,
        **body.model_dump(),
    )
    await outlet.insert()
    return outlet


@router.patch("/outlets/{outlet_id}")
async def update_outlet(
    outlet_id: str,
    body: UpdateOutletBody,
    current_user: User = Depends(require_admin),
):
    """Update an outlet's details."""
    outlet = await Outlet.get(outlet_id)
    if not outlet or outlet.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Outlet not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(outlet, field, value)
    outlet.updated_at = datetime.utcnow()
    await outlet.save()
    return outlet


# ---------------------------------------------------------------------------
# MQTT sync status
# ---------------------------------------------------------------------------

@router.get("/sync-status")
async def sync_status(
    current_user: User = Depends(require_admin),
):
    """Return the last 100 MQTT events that are unprocessed or have errors."""
    return await MqttEvent.find(
        MqttEvent.dealer_group_id == current_user.dealer_group_id,
        MqttEvent.processed == False,
    ).sort(-MqttEvent.received_at).limit(100).to_list()


@router.get("/sync-status/recent")
async def sync_status_recent(
    current_user: User = Depends(require_admin),
):
    """Return the 200 most recent MQTT events for this dealer group."""
    return await MqttEvent.find(
        MqttEvent.dealer_group_id == current_user.dealer_group_id,
    ).sort(-MqttEvent.received_at).limit(200).to_list()
