"""
Technician service.

Manages clocking (time entries), efficiency calculations, and daily loadsheets.
"""
import logging
from datetime import datetime, date, timedelta
from typing import Optional

from app.models.technician import Technician, TimeEntry
from app.models.diary import DiarySlot
from app.models.wip import WIP

logger = logging.getLogger(__name__)


async def clock_on(
    technician_id: str,
    dealer_group_id: str,
    wip_id: Optional[str] = None,
    op_code: Optional[str] = None,
    clock_type: str = "on_job",
) -> TimeEntry:
    """
    Open a new time entry for the technician.
    Any currently open entry for this technician is clocked off first.
    """
    # Close any open entry
    open_entry = await TimeEntry.find_one(
        TimeEntry.dealer_group_id == dealer_group_id,
        TimeEntry.technician_id == technician_id,
        TimeEntry.is_open == True,
    )
    if open_entry:
        now = datetime.utcnow()
        open_entry.ended_at = now
        open_entry.hours = round(
            (now - open_entry.started_at).total_seconds() / 3600, 4
        )
        open_entry.is_open = False
        await open_entry.save()

    # Look up outlet_id from the technician record
    tech = await Technician.get(technician_id)
    outlet_id = tech.outlet_id if tech else ""

    entry = TimeEntry(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        technician_id=technician_id,
        wip_id=wip_id,
        labour_op_code=op_code,
        clock_type=clock_type,
        started_at=datetime.utcnow(),
        is_open=True,
    )
    await entry.insert()
    return entry


async def clock_off(
    technician_id: str,
    dealer_group_id: str,
    notes: Optional[str] = None,
) -> TimeEntry:
    """
    Close the open time entry for this technician and compute hours worked.
    Raises ValueError if no open entry exists.
    """
    entry = await TimeEntry.find_one(
        TimeEntry.dealer_group_id == dealer_group_id,
        TimeEntry.technician_id == technician_id,
        TimeEntry.is_open == True,
    )
    if not entry:
        raise ValueError(f"No open time entry found for technician {technician_id}")

    now = datetime.utcnow()
    entry.ended_at = now
    entry.hours = round((now - entry.started_at).total_seconds() / 3600, 4)
    entry.is_open = False
    if notes:
        entry.notes = notes
    await entry.save()
    return entry


async def get_efficiency(
    technician_id: str,
    dealer_group_id: str,
    from_dt: datetime,
    to_dt: datetime,
) -> dict:
    """
    Return efficiency metrics for a technician over the given period.

    - hours_attended: sum of TimeEntry.hours where clock_type is not non_productive/training/admin
    - hours_sold: sum of WIP.labour_lines.hours where completed=True and technician_id matches
    - efficiency_pct: (hours_sold / hours_attended) * 100
    """
    tech = await Technician.get(technician_id)
    if not tech or tech.dealer_group_id != dealer_group_id:
        raise ValueError("Technician not found")

    # Hours attended (productive clocking — on_job + waiting)
    entries = await TimeEntry.find(
        TimeEntry.dealer_group_id == dealer_group_id,
        TimeEntry.technician_id == technician_id,
        TimeEntry.started_at >= from_dt,
        TimeEntry.started_at <= to_dt,
        TimeEntry.is_open == False,
    ).to_list()

    attended_types = {"on_job", "waiting"}
    hours_attended = sum(
        e.hours or 0.0 for e in entries if e.clock_type in attended_types
    )

    # Hours sold: completed labour lines on WIPs allocated to this technician
    wips = await WIP.find(
        WIP.dealer_group_id == dealer_group_id,
        WIP.allocated_technician_id == technician_id,
    ).to_list()

    hours_sold = 0.0
    for wip in wips:
        for line in wip.labour_lines:
            if line.technician_id == technician_id and line.completed:
                if line.completed_at and from_dt <= line.completed_at <= to_dt:
                    hours_sold += line.hours

    efficiency_pct = round((hours_sold / hours_attended * 100), 2) if hours_attended > 0 else 0.0

    return {
        "technician_id": technician_id,
        "technician_name": tech.name,
        "tech_code": tech.tech_code,
        "grade": tech.grade,
        "from_dt": from_dt.isoformat(),
        "to_dt": to_dt.isoformat(),
        "hours_attended": round(hours_attended, 2),
        "hours_sold": round(hours_sold, 2),
        "efficiency_pct": efficiency_pct,
    }


async def get_daily_loadsheet(
    dealer_group_id: str,
    outlet_id: str,
    target_date: date,
) -> list[dict]:
    """
    For each active technician in the outlet, return:
    - Their diary slots for the day
    - Any open time entry
    - WIPs they are allocated to
    """
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
    day_end = day_start + timedelta(days=1)

    technicians = await Technician.find(
        Technician.dealer_group_id == dealer_group_id,
        Technician.outlet_id == outlet_id,
        Technician.is_active == True,
    ).sort(Technician.name).to_list()

    loadsheet: list[dict] = []

    for tech in technicians:
        tech_id = str(tech.id)

        # Diary slots for the day
        slots = await DiarySlot.find(
            DiarySlot.dealer_group_id == dealer_group_id,
            DiarySlot.outlet_id == outlet_id,
            DiarySlot.assigned_to_id == tech_id,
            DiarySlot.start_time >= day_start,
            DiarySlot.start_time < day_end,
        ).sort(DiarySlot.start_time).to_list()

        # Open time entry
        open_entry = await TimeEntry.find_one(
            TimeEntry.dealer_group_id == dealer_group_id,
            TimeEntry.technician_id == tech_id,
            TimeEntry.is_open == True,
        )

        # Allocated WIPs
        allocated_wips = await WIP.find(
            WIP.dealer_group_id == dealer_group_id,
            WIP.outlet_id == outlet_id,
            WIP.allocated_technician_id == tech_id,
            WIP.status.in_(["open", "in_progress", "awaiting_parts"]),  # type: ignore[attr-defined]
        ).to_list()

        loadsheet.append({
            "technician": tech.model_dump(),
            "diary_slots": [s.model_dump() for s in slots],
            "open_time_entry": open_entry.model_dump() if open_entry else None,
            "allocated_wips": [
                {
                    "id": str(w.id),
                    "oem_wip_ref": w.oem_wip_ref,
                    "vehicle_registration": w.vehicle_registration,
                    "job_type": w.job_type,
                    "status": w.status,
                    "labour_total": w.labour_total,
                }
                for w in allocated_wips
            ],
        })

    return loadsheet
