from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.customer import Customer, ManufacturerRef
from app.models.user import User
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["customers"])


class ManufacturerRefIn(BaseModel):
    brand_id: str
    manufacturer_customer_id: str
    system_id: str = ""


class CustomerIn(BaseModel):
    outlet_id: str
    title: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    company_name: Optional[str] = None
    is_business: bool = False
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: str = "GB"
    manufacturer_refs: list[ManufacturerRefIn] = []


@router.get("")
async def list_customers(
    q: Optional[str] = Query(None, description="Name / email / postcode search"),
    outlet_id: Optional[str] = Query(None),
    manufacturer_id: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    filters = [
        Customer.dealer_group_id == current_user.dealer_group_id,
        Customer.is_deleted == False,
    ]
    if outlet_id:
        filters.append(Customer.outlet_id == outlet_id)

    # Search by manufacturer ID
    if manufacturer_id and brand_id:
        result = await customer_service.find_by_manufacturer_id(
            current_user.dealer_group_id, brand_id, manufacturer_id
        )
        return [result] if result else []

    customers = await Customer.find(*filters).skip(skip).limit(limit).to_list()

    # Client-side text filter (for small result sets); for production use MongoDB Atlas Search
    if q:
        q_lower = q.lower()
        customers = [
            c for c in customers
            if q_lower in c.first_name.lower()
            or q_lower in c.last_name.lower()
            or (c.email and q_lower in c.email.lower())
            or (c.postcode and q_lower in c.postcode.replace(" ", "").lower())
        ]

    return customers


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerIn,
    current_user: User = Depends(get_current_user),
):
    customer = Customer(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=body.outlet_id,
        title=body.title,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
        mobile=body.mobile,
        company_name=body.company_name,
        is_business=body.is_business,
        address_line_1=body.address_line_1,
        address_line_2=body.address_line_2,
        town=body.town,
        county=body.county,
        postcode=body.postcode,
        country=body.country,
        manufacturer_refs=[ManufacturerRef(**r.model_dump()) for r in body.manufacturer_refs],
        source="manual",
    )
    await customer.insert()
    return customer


@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    current_user: User = Depends(get_current_user),
):
    customer = await Customer.get(customer_id)
    if not customer or customer.dealer_group_id != current_user.dealer_group_id or customer.is_deleted:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}")
async def update_customer(
    customer_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
):
    customer = await Customer.get(customer_id)
    if not customer or customer.dealer_group_id != current_user.dealer_group_id or customer.is_deleted:
        raise HTTPException(status_code=404, detail="Customer not found")

    allowed = [
        "title", "first_name", "last_name", "email", "phone", "mobile",
        "company_name", "is_business", "address_line_1", "address_line_2",
        "town", "county", "postcode", "country",
    ]
    for field in allowed:
        if field in body:
            setattr(customer, field, body[field])
    customer.updated_at = datetime.utcnow()
    await customer.save()
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    current_user: User = Depends(get_current_user),
):
    customer = await Customer.get(customer_id)
    if not customer or customer.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_deleted = True
    customer.updated_at = datetime.utcnow()
    await customer.save()


@router.get("/{customer_id}/fuzzy-matches")
async def fuzzy_matches(
    customer_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return candidate duplicate records for a given customer."""
    customer = await Customer.get(customer_id)
    if not customer or customer.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    matches = await customer_service.fuzzy_match(
        current_user.dealer_group_id,
        customer.first_name,
        customer.last_name,
        customer.email,
        customer.postcode,
    )
    return [
        {"customer": m.customer, "score": m.score, "reason": m.match_reason}
        for m in matches
        if str(m.customer.id) != customer_id
    ]
