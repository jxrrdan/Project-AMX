from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.financial import Invoice, InvoiceLine, CreditNote, GLEntry
from app.models.user import User

router = APIRouter(prefix="/credit-notes", tags=["credit-notes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _next_cn_number(dealer_group_id: str, outlet_id: str) -> str:
    """Generate credit note number: {outlet_code}-CN-{YYYY}-{NNNNNN}"""
    from datetime import date
    year = date.today().year

    last = await CreditNote.find(
        CreditNote.dealer_group_id == dealer_group_id,
        CreditNote.outlet_id == outlet_id,
    ).sort(-CreditNote.created_at).first_or_none()

    seq = 1
    if last and last.credit_note_number:
        try:
            seq = int(last.credit_note_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            pass

    return f"{outlet_id.upper()}-CN-{year}-{seq:06d}"


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CreditLineRequest(BaseModel):
    line_number: int
    quantity: float  # Partial credit: <= original line quantity


class CreateCreditNoteBody(BaseModel):
    reason: str  # "pricing_error" | "warranty_adjustment" | "goodwill" | "return" | "other"
    reason_notes: Optional[str] = None
    lines_to_credit: list[CreditLineRequest] = []  # Empty = full reversal


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_credit_notes(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List credit notes with optional outlet and status filters."""
    filters = [CreditNote.dealer_group_id == current_user.dealer_group_id]
    if outlet_id:
        filters.append(CreditNote.outlet_id == outlet_id)
    if status:
        filters.append(CreditNote.status == status)

    return (
        await CreditNote.find(*filters)
        .sort(-CreditNote.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )


@router.post("/from-invoice/{invoice_id}", status_code=201)
async def create_from_invoice(
    invoice_id: str,
    body: CreateCreditNoteBody,
    current_user: User = Depends(get_current_user),
):
    """
    Create a credit note reversing some or all lines of a posted invoice.
    - If lines_to_credit is empty, all lines are fully credited.
    - Otherwise, each entry specifies a line_number and a (possibly partial) quantity.
    """
    invoice = await Invoice.get(invoice_id)
    if not invoice or invoice.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in ("posted", "paid"):
        raise HTTPException(
            status_code=400,
            detail="Credit notes can only be raised against posted or paid invoices",
        )

    # Build the line map from the original invoice
    inv_line_map = {ln.line_number: ln for ln in invoice.lines}

    credit_lines: list[InvoiceLine] = []

    if not body.lines_to_credit:
        # Full reversal of all lines
        credit_lines = list(invoice.lines)
    else:
        for req in body.lines_to_credit:
            orig = inv_line_map.get(req.line_number)
            if not orig:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {req.line_number} not found on invoice {invoice.invoice_number}",
                )
            qty_ratio = req.quantity / orig.quantity if orig.quantity else 1.0
            credit_lines.append(
                InvoiceLine(
                    line_number=orig.line_number,
                    description=orig.description,
                    quantity=req.quantity,
                    unit_price=orig.unit_price,
                    discount_pct=orig.discount_pct,
                    net_amount=round(orig.net_amount * qty_ratio, 2),
                    tax_rate=orig.tax_rate,
                    tax_amount=round(orig.tax_amount * qty_ratio, 2),
                    gross_amount=round(orig.gross_amount * qty_ratio, 2),
                    posting_group_type=orig.posting_group_type,
                    gl_revenue_code=orig.gl_revenue_code,
                    reference=orig.reference,
                )
            )

    net_total = round(sum(ln.net_amount for ln in credit_lines), 2)
    tax_total = round(sum(ln.tax_amount for ln in credit_lines), 2)
    gross_total = round(net_total + tax_total, 2)

    cn_number = await _next_cn_number(current_user.dealer_group_id, invoice.outlet_id)

    cn = CreditNote(
        dealer_group_id=current_user.dealer_group_id,
        outlet_id=invoice.outlet_id,
        credit_note_number=cn_number,
        original_invoice_id=str(invoice.id),
        original_invoice_number=invoice.invoice_number,
        reason=body.reason,
        reason_notes=body.reason_notes,
        lines=credit_lines,
        net_total=net_total,
        tax_total=tax_total,
        gross_total=gross_total,
        customer_id=invoice.customer_id,
        customer_name=invoice.customer_name,
        status="draft",
        created_by=str(current_user.id),
    )
    await cn.insert()
    return cn


@router.get("/{cn_id}")
async def get_credit_note(
    cn_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve a credit note by ID."""
    cn = await CreditNote.get(cn_id)
    if not cn or cn.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Credit note not found")
    return cn


@router.post("/{cn_id}/post-gl")
async def post_gl(
    cn_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Post the credit note to the General Ledger as reversals.
    Creates: CR Trade Debtors (gross), DR Revenue (net), DR VAT Control (tax).
    """
    cn = await CreditNote.get(cn_id)
    if not cn or cn.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Credit note not found")
    if cn.gl_posted:
        raise HTTPException(status_code=400, detail="Credit note already posted to GL")
    if cn.status == "draft":
        raise HTTPException(status_code=400, detail="Credit note must be posted before GL entries are created")

    entries: list[GLEntry] = []

    for line in cn.lines:
        # CR Trade Debtors (reversal: we are reducing what customer owes)
        entries.append(GLEntry(
            dealer_group_id=current_user.dealer_group_id,
            outlet_id=cn.outlet_id,
            invoice_id=str(cn.id),
            invoice_number=cn.credit_note_number,
            gl_code="2000",
            gl_name="Trade Debtors",
            entry_type="credit",
            amount=line.gross_amount,
            description=f"CN {cn.credit_note_number} — {line.description}",
            reference=cn.credit_note_number,
        ))
        # DR Revenue (reversal)
        entries.append(GLEntry(
            dealer_group_id=current_user.dealer_group_id,
            outlet_id=cn.outlet_id,
            invoice_id=str(cn.id),
            invoice_number=cn.credit_note_number,
            gl_code=line.gl_revenue_code,
            gl_name=f"Revenue ({line.posting_group_type})",
            entry_type="debit",
            amount=line.net_amount,
            description=f"CN {cn.credit_note_number} — {line.description}",
            reference=cn.credit_note_number,
        ))
        if line.tax_amount > 0:
            # DR VAT Control (reversal)
            entries.append(GLEntry(
                dealer_group_id=current_user.dealer_group_id,
                outlet_id=cn.outlet_id,
                invoice_id=str(cn.id),
                invoice_number=cn.credit_note_number,
                gl_code="2100",
                gl_name="VAT Control",
                entry_type="debit",
                amount=line.tax_amount,
                description=f"VAT reversal — CN {cn.credit_note_number}",
                reference=cn.credit_note_number,
            ))

    for entry in entries:
        await entry.insert()

    cn.gl_posted = True
    cn.gl_posted_at = datetime.utcnow()
    cn.status = "posted"
    cn.updated_at = datetime.utcnow()
    await cn.save()

    return {"entries_created": len(entries), "credit_note_id": cn_id}


@router.get("/{cn_id}/html")
async def get_credit_note_html(
    cn_id: str,
    current_user: User = Depends(get_current_user),
):
    """Render a credit note as HTML using the invoice template system."""
    from app.models.financial import InvoiceTemplate
    from jinja2 import Environment

    cn = await CreditNote.get(cn_id)
    if not cn or cn.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Credit note not found")

    template_doc = await InvoiceTemplate.find_one(
        InvoiceTemplate.dealer_group_id == current_user.dealer_group_id,
        InvoiceTemplate.template_id == "default",
    )

    if template_doc:
        env = Environment(autoescape=True)
        tmpl = env.from_string(template_doc.html_template)
        html = tmpl.render(invoice=cn, dealer=template_doc, is_credit_note=True)
    else:
        html = _default_cn_html(cn)

    return Response(content=html, media_type="text/html")


def _default_cn_html(cn: CreditNote) -> str:
    lines_html = "".join(
        f"<tr><td>{l.description}</td><td style='text-align:right'>{l.quantity}</td>"
        f"<td style='text-align:right'>£{l.unit_price:.2f}</td>"
        f"<td style='text-align:right'>£{l.net_amount:.2f}</td>"
        f"<td style='text-align:right'>£{l.tax_amount:.2f}</td>"
        f"<td style='text-align:right'>£{l.gross_amount:.2f}</td></tr>"
        for l in cn.lines
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 12px; margin: 40px; }}
  h1 {{ color: #dc2626; }} table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
  th, td {{ border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }}
  th {{ background: #fef2f2; text-align: left; font-size: 11px; text-transform: uppercase; }}
  .totals {{ margin-top: 12px; text-align: right; }}
</style></head>
<body>
<h1>Credit Note {cn.credit_note_number}</h1>
<p><strong>Original Invoice:</strong> {cn.original_invoice_number}</p>
<p><strong>To:</strong> {cn.customer_name}</p>
<p><strong>Date:</strong> {cn.created_at.strftime('%d/%m/%Y')}</p>
<p><strong>Reason:</strong> {cn.reason}</p>
<table>
<thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Net</th><th>VAT</th><th>Gross</th></tr></thead>
<tbody>{lines_html}</tbody>
</table>
<div class="totals">
  <p>Net: <strong>£{cn.net_total:.2f}</strong></p>
  <p>VAT: <strong>£{cn.tax_total:.2f}</strong></p>
  <p style="font-size:14px">Total Credit: <strong>£{cn.gross_total:.2f}</strong></p>
</div>
</body></html>"""
