from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.financial import Invoice, GLAccount, PostingGroup, InvoiceTemplate
from app.models.user import User
from app.services import financial_service

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("")
async def list_invoices(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    invoice_type: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    filters = [Invoice.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(Invoice.outlet_id == outlet_id)
    if status:
        filters.append(Invoice.status == status)
    if invoice_type:
        filters.append(Invoice.invoice_type == invoice_type)

    return await Invoice.find(*filters).sort(-Invoice.invoice_date).skip(skip).limit(limit).to_list()


@router.post("/from-wip/{wip_id}", status_code=201)
async def create_from_wip(wip_id: str, current_user: User = Depends(get_current_user)):
    try:
        invoice = await financial_service.create_workshop_invoice(
            wip_id,
            current_user.dealer_group_id,
            current_user.outlet_ids[0] if current_user.outlet_ids else "default",
            created_by=str(current_user.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return invoice


@router.post("/from-order/{order_id}/accessories", status_code=201)
async def create_from_order_accessories(order_id: str, current_user: User = Depends(get_current_user)):
    try:
        invoice = await financial_service.create_accessory_invoice(
            order_id,
            current_user.dealer_group_id,
            current_user.outlet_ids[0] if current_user.outlet_ids else "default",
            created_by=str(current_user.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return invoice


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, current_user: User = Depends(get_current_user)):
    inv = await Invoice.get(invoice_id)
    if not inv or inv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.post("/{invoice_id}/post-gl")
async def post_gl(invoice_id: str, current_user: User = Depends(get_current_user)):
    try:
        entries = await financial_service.post_to_gl(invoice_id, current_user.dealer_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"entries_created": len(entries), "invoice_id": invoice_id}


@router.get("/{invoice_id}/html")
async def get_invoice_html(invoice_id: str, current_user: User = Depends(get_current_user)):
    try:
        html = await financial_service.render_invoice_html(invoice_id, current_user.dealer_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Response(content=html, media_type="text/html")


@router.post("/{invoice_id}/email")
async def email_invoice(
    invoice_id: str,
    to_email: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    inv = await Invoice.get(invoice_id)
    if not inv or inv.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    recipient = to_email or inv.customer_email
    if not recipient:
        raise HTTPException(status_code=400, detail="No email address available")

    # Email delivery is handled by the deployment's email service (SES, SMTP, etc.)
    # Here we just mark the invoice and return — hook up your email provider in production
    inv.emailed_to = recipient
    inv.emailed_at = datetime.utcnow()
    inv.updated_at = datetime.utcnow()
    await inv.save()

    return {"emailed_to": recipient, "invoice_number": inv.invoice_number}


# ---------------------------------------------------------------------------
# GL Accounts & Posting Groups
# ---------------------------------------------------------------------------

gl_router = APIRouter(prefix="/finance", tags=["finance"])


@gl_router.get("/accounts")
async def list_accounts(current_user: User = Depends(get_current_user)):
    return await GLAccount.find(GLAccount.dealer_group_id == current_user.dealer_group_id).to_list()


@gl_router.post("/accounts", status_code=201)
async def create_account(body: dict, current_user: User = Depends(get_current_user)):
    account = GLAccount(dealer_group_id=current_user.dealer_group_id, **body)
    await account.insert()
    return account


@gl_router.get("/posting-groups")
async def list_posting_groups(current_user: User = Depends(get_current_user)):
    return await PostingGroup.find(PostingGroup.dealer_group_id == current_user.dealer_group_id).to_list()


@gl_router.post("/posting-groups", status_code=201)
async def create_posting_group(body: dict, current_user: User = Depends(get_current_user)):
    pg = PostingGroup(dealer_group_id=current_user.dealer_group_id, **body)
    await pg.insert()
    return pg


@gl_router.get("/ledger")
async def get_ledger(
    gl_code: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    from app.models.financial import GLEntry
    filters = [GLEntry.dealer_group_id == current_user.dealer_group_id]
    if gl_code:
        filters.append(GLEntry.gl_code == gl_code)
    return await GLEntry.find(*filters).sort(-GLEntry.entry_date).limit(500).to_list()
