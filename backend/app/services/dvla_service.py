"""
DVLA Vehicle Enquiry Service (VES) API integration.
Docs: https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html
"""
import httpx
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)

VES_URL = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"

# Mapping DVLA fuel types to our internal labels
FUEL_TYPE_MAP = {
    "PETROL": "Petrol",
    "DIESEL": "Diesel",
    "ELECTRIC": "Electric",
    "HYBRID ELECTRIC": "Hybrid",
    "PLUG-IN HYBRID ELECTRIC": "PHEV",
    "GAS": "LPG",
}


async def lookup_vehicle(registration: str) -> dict:
    """
    Query the DVLA VES API for a UK registration number.
    Returns a normalised dict or raises ValueError if not found.
    """
    settings = get_settings()
    api_key = getattr(settings, "DVLA_API_KEY", None)

    if not api_key:
        raise ValueError("DVLA_API_KEY not configured")

    reg = registration.replace(" ", "").upper()

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            VES_URL,
            json={"registrationNumber": reg},
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json",
            },
        )

    if response.status_code == 404:
        raise ValueError(f"Vehicle with registration {reg} not found in DVLA records")
    if response.status_code == 400:
        raise ValueError("Invalid registration number format")
    if response.status_code != 200:
        logger.error("DVLA VES error %s: %s", response.status_code, response.text)
        raise ValueError("DVLA lookup failed. Please try again later.")

    data = response.json()

    year: int | None = None
    month_str = data.get("monthOfFirstRegistration")  # e.g. "2019-03"
    if month_str:
        try:
            year = int(month_str.split("-")[0])
        except (ValueError, IndexError):
            pass

    fuel_raw = data.get("fuelType", "").upper()

    return {
        "registration": reg,
        "make": data.get("make", "").title(),
        "model": data.get("model", "").title(),
        "colour": data.get("colour", "").title(),
        "fuel_type": FUEL_TYPE_MAP.get(fuel_raw, fuel_raw.title() or None),
        "year": year,
        "engine_cc": data.get("engineCapacity"),
        "mot_status": data.get("motStatus"),
        "tax_status": data.get("taxStatus"),
        "mot_expiry": data.get("motExpiryDate"),
        "tax_due_date": data.get("taxDueDate"),
    }
