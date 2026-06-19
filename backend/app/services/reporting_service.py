"""
Reporting service — MongoDB aggregation pipelines for management reports.

All functions accept dealer_group_id + outlet_id (for multi-outlet filtering)
and a date range, and return plain dicts suitable for JSON serialisation.
Uses motor directly for aggregation pipelines that are too complex for Beanie ODM.
"""
import logging
from datetime import datetime, date, timedelta
from typing import Optional

from beanie import Document
from motor.motor_asyncio import AsyncIOMotorCollection

logger = logging.getLogger(__name__)


def _collection(model_cls) -> AsyncIOMotorCollection:
    """Return the motor collection for a Beanie document class."""
    return model_cls.get_motor_collection()


# ---------------------------------------------------------------------------
# Workshop efficiency
# ---------------------------------------------------------------------------

async def workshop_efficiency(
    dealer_group_id: str,
    outlet_id: str,
    from_dt: datetime,
    to_dt: datetime,
) -> list[dict]:
    """
    Per technician:
      - hours_attended: sum of TimeEntry.hours where clock_type = "on_job"
        and started_at is within the date range
      - hours_sold: sum of WIP.labour_lines.hours where completed=True and
        technician_id matches, and completed_at is within the date range
      - efficiency_pct: (hours_sold / hours_attended) * 100

    Returns a list of dicts, one per technician.
    """
    from app.models.technician import Technician, TimeEntry
    from app.models.wip import WIP

    # Get active technicians for the outlet
    technicians = await Technician.find(
        Technician.dealer_group_id == dealer_group_id,
        Technician.outlet_id == outlet_id,
        Technician.is_active == True,
    ).to_list()

    te_col = _collection(TimeEntry)
    wip_col = _collection(WIP)

    results = []

    for tech in technicians:
        tech_id = str(tech.id)

        # Hours attended via aggregation
        attended_pipeline = [
            {
                "$match": {
                    "dealer_group_id": dealer_group_id,
                    "technician_id": tech_id,
                    "clock_type": "on_job",
                    "is_open": False,
                    "started_at": {"$gte": from_dt, "$lte": to_dt},
                    "hours": {"$ne": None},
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$hours"}}},
        ]
        attended_result = await te_col.aggregate(attended_pipeline).to_list(length=1)
        hours_attended = attended_result[0]["total"] if attended_result else 0.0

        # Hours sold: unwind labour_lines and filter by technician + completion date
        sold_pipeline = [
            {
                "$match": {
                    "dealer_group_id": dealer_group_id,
                    "allocated_technician_id": tech_id,
                }
            },
            {"$unwind": "$labour_lines"},
            {
                "$match": {
                    "labour_lines.technician_id": tech_id,
                    "labour_lines.completed": True,
                    "labour_lines.completed_at": {"$gte": from_dt, "$lte": to_dt},
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$labour_lines.hours"}}},
        ]
        sold_result = await wip_col.aggregate(sold_pipeline).to_list(length=1)
        hours_sold = sold_result[0]["total"] if sold_result else 0.0

        efficiency_pct = round((hours_sold / hours_attended * 100), 2) if hours_attended > 0 else 0.0

        results.append({
            "technician_id": tech_id,
            "technician_name": tech.name,
            "tech_code": tech.tech_code,
            "grade": tech.grade,
            "hours_attended": round(hours_attended, 2),
            "hours_sold": round(hours_sold, 2),
            "efficiency_pct": efficiency_pct,
        })

    results.sort(key=lambda r: r["efficiency_pct"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Revenue by invoice type
# ---------------------------------------------------------------------------

async def revenue_by_type(
    dealer_group_id: str,
    outlet_id: str,
    from_dt: datetime,
    to_dt: datetime,
) -> dict:
    """
    Sum Invoice.gross_total grouped by invoice_type for posted invoices.
    Returns: {invoice_type: {count, net_total, tax_total, gross_total}}
    """
    from app.models.financial import Invoice

    inv_col = _collection(Invoice)

    pipeline = [
        {
            "$match": {
                "dealer_group_id": dealer_group_id,
                "outlet_id": outlet_id,
                "status": {"$in": ["posted", "paid"]},
                "invoice_date": {"$gte": from_dt, "$lte": to_dt},
            }
        },
        {
            "$group": {
                "_id": "$invoice_type",
                "count": {"$sum": 1},
                "net_total": {"$sum": "$net_total"},
                "tax_total": {"$sum": "$tax_total"},
                "gross_total": {"$sum": "$gross_total"},
            }
        },
    ]

    rows = await inv_col.aggregate(pipeline).to_list(length=100)

    result: dict = {}
    for row in rows:
        result[row["_id"]] = {
            "count": row["count"],
            "net_total": round(row["net_total"], 2),
            "tax_total": round(row["tax_total"], 2),
            "gross_total": round(row["gross_total"], 2),
        }
    return result


# ---------------------------------------------------------------------------
# Parts margin
# ---------------------------------------------------------------------------

async def parts_margin(
    dealer_group_id: str,
    outlet_id: str,
    from_dt: datetime,
    to_dt: datetime,
) -> dict:
    """
    Calculate parts margin from stock transactions:
    - "issue" transactions = parts sold (negative quantity = out)
    - unit_cost from transaction
    - selling price from the Part catalogue (unit_sell)

    Returns: {cost, revenue, margin_amount, margin_pct}
    """
    from app.models.parts import StockTransaction, Part

    tx_col = _collection(StockTransaction)
    part_col = _collection(Part)

    # Get all issue transactions in the date range for this outlet
    pipeline = [
        {
            "$match": {
                "dealer_group_id": dealer_group_id,
                "outlet_id": outlet_id,
                "transaction_type": "issue",
                "created_at": {"$gte": from_dt, "$lte": to_dt},
            }
        },
        {
            "$group": {
                "_id": "$part_number",
                "total_qty": {"$sum": {"$abs": "$quantity"}},
                "total_cost": {"$sum": {"$multiply": [{"$abs": "$quantity"}, "$unit_cost"]}},
                "part_id": {"$first": "$part_id"},
            }
        },
    ]

    rows = await tx_col.aggregate(pipeline).to_list(length=10000)

    total_cost = 0.0
    total_revenue = 0.0

    for row in rows:
        total_cost += row["total_cost"]

        # Look up sell price from Part catalogue
        part_doc = await Part.find_one(
            Part.dealer_group_id == dealer_group_id,
            Part.part_number == row["_id"],
        )
        sell_price = part_doc.unit_sell if part_doc else row["total_cost"] / row["total_qty"] if row["total_qty"] else 0.0
        total_revenue += sell_price * row["total_qty"]

    margin_amount = round(total_revenue - total_cost, 2)
    margin_pct = round((margin_amount / total_revenue * 100), 2) if total_revenue > 0 else 0.0

    return {
        "cost": round(total_cost, 2),
        "revenue": round(total_revenue, 2),
        "margin_amount": margin_amount,
        "margin_pct": margin_pct,
    }


# ---------------------------------------------------------------------------
# VHC conversion rate
# ---------------------------------------------------------------------------

async def vhc_conversion(
    dealer_group_id: str,
    outlet_id: str,
    from_dt: datetime,
    to_dt: datetime,
) -> dict:
    """
    For VHCs with requires_authorisation=True created in the period:
    - total requiring authorisation
    - count authorised (status=authorised)
    - count declined (status=declined)
    - conversion rate
    """
    from app.models.vhc import VHC

    vhc_col = _collection(VHC)

    pipeline = [
        {
            "$match": {
                "dealer_group_id": dealer_group_id,
                "outlet_id": outlet_id,
                "requires_authorisation": True,
                "created_at": {"$gte": from_dt, "$lte": to_dt},
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "authorised": {
                    "$sum": {"$cond": [{"$eq": ["$status", "authorised"]}, 1, 0]}
                },
                "declined": {
                    "$sum": {"$cond": [{"$eq": ["$status", "declined"]}, 1, 0]}
                },
            }
        },
    ]

    rows = await vhc_col.aggregate(pipeline).to_list(length=1)

    if not rows:
        return {
            "total_requiring_authorisation": 0,
            "total_authorised": 0,
            "total_declined": 0,
            "authorisation_rate_pct": 0.0,
            "decline_rate_pct": 0.0,
        }

    row = rows[0]
    total = row["total"]
    authorised = row["authorised"]
    declined = row["declined"]

    return {
        "total_requiring_authorisation": total,
        "total_authorised": authorised,
        "total_declined": declined,
        "authorisation_rate_pct": round(authorised / total * 100, 2) if total > 0 else 0.0,
        "decline_rate_pct": round(declined / total * 100, 2) if total > 0 else 0.0,
    }


# ---------------------------------------------------------------------------
# Aged debtors
# ---------------------------------------------------------------------------

async def aged_debtors(
    dealer_group_id: str,
    outlet_id: str,
) -> list[dict]:
    """
    Invoices with status="posted" (not paid), grouped by age bucket:
    0-30 days, 31-60, 61-90, 90+ days.

    Returns a list of invoice-level records with their bucket label.
    """
    from app.models.financial import Invoice

    invoices = await Invoice.find(
        Invoice.dealer_group_id == dealer_group_id,
        Invoice.outlet_id == outlet_id,
        Invoice.status == "posted",
    ).sort(Invoice.invoice_date).to_list()

    now = datetime.utcnow()
    result: list[dict] = []

    for inv in invoices:
        days = (now - inv.invoice_date).days

        if days <= 30:
            bucket = "0-30"
        elif days <= 60:
            bucket = "31-60"
        elif days <= 90:
            bucket = "61-90"
        else:
            bucket = "90+"

        result.append({
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.date().isoformat(),
            "customer_id": inv.customer_id,
            "customer_name": inv.customer_name,
            "gross_total": inv.gross_total,
            "days_outstanding": days,
            "age_bucket": bucket,
        })

    return result
