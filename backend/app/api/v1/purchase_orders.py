from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.purchase_order import Supplier, PurchaseOrder, POLine
from app.models.parts import StockLevel, StockTransaction
from app.models.user import User

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _next_po_number(dealer_group_id: str, outlet_id: str) -> str:
    """Generate PO number: {outlet_code}-PO-{YY}{NNNNNN}"""
    from datetime import date as _date
    yy = str(_date.today().year)[2:]

    last = await PurchaseOrder.find(
        PurchaseOrder.dealer_group_id == dealer_group_id,
        PurchaseOrder.outlet_id == outlet_id,
    ).sort(-PurchaseOrder.created_at).first_or_none()

    seq = 1
    if last and last.po_number:
        try:
            seq = int(last.po_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            pass

    return f"{outlet_id.upper()}-PO-{yy}{seq:06d}"


# ---------------------------------------------------------------------------
# Supplier endpoints
# ---------------------------------------------------------------------------

class CreateSupplierBody(BaseModel):
    name: str
    account_code: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30
    gl_creditor_code: str = "3000"
    brand_ids: list[str] = []


@router.get("/suppliers")
async def list_suppliers(
    current_user: User = Depends(get_current_user),
):
    """List all active suppliers for this dealer group."""
    return await Supplier.find(
        Supplier.dealer_group_id == current_user.dealer_group_id,
        Supplier.is_active == True,
    ).sort(Supplier.name).to_list()


@router.post("/suppliers", status_code=201)
async def create_supplier(
    body: CreateSupplierBody,
    current_user: User = Depends(get_current_user),
):
    """Create a new supplier."""
    supplier = Supplier(
        dealer_group_id=current_user.dealer_group_id,
        **body.model_dump(),
    )
    await supplier.insert()
    return supplier


# ---------------------------------------------------------------------------
# Purchase order endpoints
# ---------------------------------------------------------------------------

class POLineBody(BaseModel):
    line_number: int
    part_number: Optional[str] = None
    description: str
    quantity: int
    unit_cost: float
    total_cost: float
    wip_id: Optional[str] = None


class CreatePOBody(BaseModel):
    outlet_id: str
    supplier_id: str
    supplier_name: str
    po_type: str = "parts"
    lines: list[POLineBody] = []
    expected_delivery: Optional[date] = None
    delivery_notes: Optional[str] = None
    wip_id: Optional[str] = None


class ReceiveLineBody(BaseModel):
    line_number: int
    quantity_received: int


@router.get("")
async def list_purchase_orders(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List purchase orders with optional filters."""
    filters = [PurchaseOrder.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(PurchaseOrder.outlet_id == outlet_id)
    if status:
        filters.append(PurchaseOrder.status == status)
    if supplier_id:
        filters.append(PurchaseOrder.supplier_id == supplier_id)

    return (
        await PurchaseOrder.find(*filters)
        .sort(-PurchaseOrder.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("", status_code=201)
async def create_purchase_order(
    body: CreatePOBody,
    current_user: User = Depends(get_current_user),
):
    """Create a new purchase order."""
    po_number = await _next_po_number(current_user.dealer_group_id, body.outlet_id)

    lines = [POLine(**ln.model_dump()) for ln in body.lines]
    net_total = round(sum(ln.total_cost for ln in lines), 2)
    tax_total = round(net_total * 0.20, 2)
    gross_total = round(net_total + tax_total, 2)

    po = PurchaseOrder(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=body.outlet_id,
        po_number=po_number,
        supplier_id=body.supplier_id,
        supplier_name=body.supplier_name,
        po_type=body.po_type,
        lines=lines,
        net_total=net_total,
        tax_total=tax_total,
        gross_total=gross_total,
        status="draft",
        wip_id=body.wip_id,
        expected_delivery=body.expected_delivery,
        delivery_notes=body.delivery_notes,
        raised_by=str(current_user.id),
    )
    await po.insert()
    return po


@router.get("/{po_id}")
async def get_purchase_order(
    po_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve a purchase order by ID."""
    po = await PurchaseOrder.get(po_id)
    if not po or po.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.patch("/{po_id}/send")
async def send_purchase_order(
    po_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark a purchase order as sent to the supplier."""
    po = await PurchaseOrder.get(po_id)
    if not po or po.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft POs can be marked as sent")

    po.status = "sent"
    po.updated_at = datetime.utcnow()
    await po.save()
    return po


@router.post("/{po_id}/receive")
async def receive_purchase_order(
    po_id: str,
    received_lines: list[ReceiveLineBody],
    current_user: User = Depends(get_current_user),
):
    """
    Record receipt of goods against a PO.
    - Updates each matched line's quantity_received and status.
    - Creates a StockTransaction receipt for parts lines.
    - Updates PO status: partial / received.
    """
    po = await PurchaseOrder.get(po_id)
    if not po or po.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status in ("received", "cancelled"):
        raise HTTPException(status_code=400, detail=f"PO is already {po.status}")

    line_map = {ln.line_number: ln for ln in po.lines}
    receipt_map = {r.line_number: r.quantity_received for r in received_lines}

    for line in po.lines:
        recv_qty = receipt_map.get(line.line_number, 0)
        if recv_qty <= 0:
            continue

        line.quantity_received = min(line.quantity_received + recv_qty, line.quantity)

        if line.quantity_received >= line.quantity:
            line.status = "received"
        elif line.quantity_received > 0:
            line.status = "partial"

        # Create stock receipt transaction for parts
        if po.po_type == "parts" and line.part_number:
            stock = await StockLevel.find_one(
                StockLevel.dealer_group_id == current_user.dealer_group_id,
                StockLevel.outlet_id == po.outlet_id,
                StockLevel.part_number == line.part_number,
            )
            if stock:
                stock.quantity_on_hand += recv_qty
                stock.quantity_available = stock.quantity_on_hand - stock.quantity_allocated
                stock.last_received_at = datetime.utcnow()
                stock.updated_at = datetime.utcnow()
                await stock.save()

            await StockTransaction(
                dealer_group_id=current_user.dealer_group_id,
                outlet_id=po.outlet_id,
                part_id=stock.part_id if stock else "",
                part_number=line.part_number,
                transaction_type="receipt",
                quantity=recv_qty,
                unit_cost=line.unit_cost,
                reference_type="po",
                reference_id=str(po.id),
                created_by=str(current_user.id),
            ).insert()

    # Determine overall PO status
    all_received = all(ln.status == "received" for ln in po.lines)
    any_received = any(ln.quantity_received > 0 for ln in po.lines)

    if all_received:
        po.status = "received"
        po.received_at = datetime.utcnow()
    elif any_received:
        po.status = "partial"

    po.updated_at = datetime.utcnow()
    await po.save()
    return po


@router.post("/{po_id}/cancel")
async def cancel_purchase_order(
    po_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a purchase order."""
    po = await PurchaseOrder.get(po_id)
    if not po or po.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status in ("received", "invoiced"):
        raise HTTPException(status_code=400, detail="Cannot cancel a received or invoiced PO")

    po.status = "cancelled"
    po.updated_at = datetime.utcnow()
    await po.save()
    return po
