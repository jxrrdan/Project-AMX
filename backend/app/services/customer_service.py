from datetime import datetime
from thefuzz import fuzz
from app.models.customer import Customer, ManufacturerRef


FUZZY_MATCH_THRESHOLD = 80  # Minimum score to consider a match


class FuzzyMatchResult:
    def __init__(self, customer: Customer, score: int, match_reason: str):
        self.customer = customer
        self.score = score
        self.match_reason = match_reason


async def find_by_manufacturer_id(
    dealer_group_id: str,
    brand_id: str,
    manufacturer_customer_id: str,
) -> Customer | None:
    return await Customer.find_one(
        Customer.dealer_group_id == dealer_group_id,
        Customer.is_deleted == False,
        {
            "manufacturer_refs": {
                "$elemMatch": {
                    "brand_id": brand_id,
                    "manufacturer_customer_id": manufacturer_customer_id,
                }
            }
        },
    )


async def fuzzy_match(
    dealer_group_id: str,
    first_name: str,
    last_name: str,
    email: str | None = None,
    postcode: str | None = None,
    limit: int = 5,
) -> list[FuzzyMatchResult]:
    """
    Fuzzy-match an incoming customer record against existing customers.
    Uses a weighted scoring approach: surname is the primary signal, then
    forename, then email/postcode as tiebreakers.
    """
    # Pull candidates by surname prefix to limit the scan — MongoDB can't
    # execute fuzzy string matching natively, so we filter by first 3 chars.
    surname_prefix = last_name[:3].upper() if len(last_name) >= 3 else last_name.upper()

    candidates = await Customer.find(
        Customer.dealer_group_id == dealer_group_id,
        Customer.is_deleted == False,
    ).to_list()

    results: list[FuzzyMatchResult] = []

    for candidate in candidates:
        # Surname is the dominant signal
        surname_score = fuzz.ratio(last_name.upper(), candidate.last_name.upper())
        if surname_score < 60:
            continue

        forename_score = fuzz.ratio(first_name.upper(), candidate.first_name.upper())

        # Boost for exact email match
        email_boost = 0
        if email and candidate.email:
            if email.lower() == candidate.email.lower():
                email_boost = 20
            elif fuzz.ratio(email.lower(), candidate.email.lower()) > 90:
                email_boost = 10

        # Boost for postcode match
        postcode_boost = 0
        if postcode and candidate.postcode:
            clean_pc = postcode.replace(" ", "").upper()
            clean_cand = candidate.postcode.replace(" ", "").upper()
            if clean_pc == clean_cand:
                postcode_boost = 10

        composite = (surname_score * 0.5) + (forename_score * 0.4) + email_boost + postcode_boost

        if composite >= FUZZY_MATCH_THRESHOLD:
            reason = f"Name match (surname:{surname_score}%, forename:{forename_score}%)"
            if email_boost:
                reason += " + email match"
            if postcode_boost:
                reason += " + postcode match"
            results.append(FuzzyMatchResult(candidate, int(composite), reason))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:limit]


async def upsert_from_mqtt(
    dealer_group_id: str,
    outlet_id: str,
    payload: dict,
) -> tuple[Customer, bool]:
    """
    Upsert a customer from an incoming MQTT sync payload.
    Returns (customer, was_created).

    Matching priority:
    1. Manufacturer customer ID exact match
    2. Fuzzy name+email+postcode match above threshold
    3. Create new record
    """
    brand_id = payload.get("brand_id", "")
    mfr_id = payload.get("manufacturer_customer_id", "")

    # 1. Exact match on manufacturer ID
    if brand_id and mfr_id:
        existing = await find_by_manufacturer_id(dealer_group_id, brand_id, mfr_id)
        if existing:
            return await _update_customer(existing, payload, outlet_id), False

    # 2. Fuzzy match
    first_name = payload.get("first_name", "")
    last_name = payload.get("last_name", "")
    email = payload.get("email")
    postcode = payload.get("postcode")

    if first_name and last_name:
        matches = await fuzzy_match(dealer_group_id, first_name, last_name, email, postcode, limit=1)
        if matches and matches[0].score >= FUZZY_MATCH_THRESHOLD:
            existing = matches[0].customer
            # Attach the new manufacturer ref if not already present
            if brand_id and mfr_id:
                _ensure_manufacturer_ref(existing, brand_id, mfr_id, payload.get("system_id", ""))
            return await _update_customer(existing, payload, outlet_id), False

    # 3. Create new
    customer = Customer(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        first_name=first_name,
        last_name=last_name,
        email=payload.get("email"),
        phone=payload.get("phone"),
        mobile=payload.get("mobile"),
        address_line_1=payload.get("address_line_1"),
        address_line_2=payload.get("address_line_2"),
        town=payload.get("town"),
        county=payload.get("county"),
        postcode=postcode,
        manufacturer_refs=[
            ManufacturerRef(
                brand_id=brand_id,
                manufacturer_customer_id=mfr_id,
                system_id=payload.get("system_id", ""),
            )
        ] if brand_id and mfr_id else [],
        source="mqtt_sync",
    )
    await customer.insert()
    return customer, True


def _ensure_manufacturer_ref(customer: Customer, brand_id: str, mfr_id: str, system_id: str) -> None:
    for ref in customer.manufacturer_refs:
        if ref.brand_id == brand_id and ref.manufacturer_customer_id == mfr_id:
            return
    customer.manufacturer_refs.append(
        ManufacturerRef(brand_id=brand_id, manufacturer_customer_id=mfr_id, system_id=system_id)
    )


async def _update_customer(customer: Customer, payload: dict, outlet_id: str) -> Customer:
    updatable = ["email", "phone", "mobile", "address_line_1", "address_line_2", "town", "county", "postcode"]
    for field in updatable:
        if payload.get(field):
            setattr(customer, field, payload[field])
    customer.updated_at = datetime.utcnow()
    await customer.save()
    return customer
