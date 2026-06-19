from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.vehicle import Vehicle
from app.models.customer import CustomerVehicle
from app.models.user import User
from app.services import dvla_service

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


class VehicleIn(BaseModel):
    outlet_id: str
    vin: Optional[str] = None
    registration: Optional[str] = None
    make: str
    model: str
    derivative: Optional[str] = None
    colour: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    year: Optional[int] = None
    mileage: Optional[int] = None
    brand_id: Optional[str] = None


@router.get("/dvla-lookup")
async def dvla_lookup(
    registration: str,
    current_user: User = Depends(get_current_user),
):
    """Proxy to the DVLA VES API — enriches a vehicle record from the UK registration."""
    try:
        return await dvla_service.lookup_vehicle(registration)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("")
async def list_vehicles(
    q: Optional[str] = Query(None, description="VIN / registration / make / model"),
    outlet_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    filters = [Vehicle.dealer_group_id == current_user.dealer_group_id, Vehicle.is_deleted == False]
    if outlet_id:
        filters.append(Vehicle.outlet_id == outlet_id)

    vehicles = await Vehicle.find(*filters).skip(skip).limit(limit).to_list()

    if q:
        q_lower = q.lower()
        vehicles = [
            v for v in vehicles
            if (v.vin and q_lower in v.vin.lower())
            or (v.registration and q_lower in v.registration.replace(" ", "").lower())
            or q_lower in v.make.lower()
            or q_lower in v.model.lower()
        ]
    return vehicles


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_vehicle(body: VehicleIn, current_user: User = Depends(get_current_user)):
    vehicle = Vehicle(dealer_group_id=current_user.dealer_group_id, source="manual", **body.model_dump())
    await vehicle.insert()
    return vehicle


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str, current_user: User = Depends(get_current_user)):
    vehicle = await Vehicle.get(vehicle_id)
    if not vehicle or vehicle.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.get("/{vehicle_id}/customers")
async def get_vehicle_customers(vehicle_id: str, current_user: User = Depends(get_current_user)):
    links = await CustomerVehicle.find(
        CustomerVehicle.dealer_group_id == current_user.dealer_group_id,
        CustomerVehicle.vehicle_id == vehicle_id,
    ).to_list()
    return links
