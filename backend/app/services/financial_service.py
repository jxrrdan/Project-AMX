"""
Financial service: invoice creation, GL posting, PDF generation, email delivery.
"""
import logging
from datetime import datetime
from typing import Optional

from app.models.financial import (
    Invoice, InvoiceLine, GLEntry, GLAccount, PostingGroup, InvoiceTemplate
)
from app.models.wip import WIP
from app.models.order import Order
from app.models.customer import Customer
from app.core.config import get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Invoice number generation
# ---------------------------------------------------------------------------

async def next_invoice_number(dealer_group_id: str, outlet_id: str) -> str:
    """Generate a sequential invoice number per outlet: {outlet_code}-{YYYY}-{NNNNNN}"""
    from datetime import date
    year = date.today().year

    last = await Invoice.find(
        Invoice.dealer_group_id == dealer_group_id,
        Invoice.outlet_id == outlet_id,
    ).sort(-Invoice.created_at).first_or_none()

    seq = 1
    if last and last.invoice_number:
        try:
            seq = int(last.invoice_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            pass

    return f"{outlet_id.upper()}-{year}-{seq:06d}"


# ---------------------------------------------------------------------------
# Build invoice from a WIP (workshop / parts)
# ---------------------------------------------------------------------------

async def create_workshop_invoice(
    wip_id: str,
    dealer_group_id: str,
    outlet_id: str,
    created_by: Optional[str] = None,
) -> Invoice:
    wip = await WIP.get(wip_id)
    if not wip or wip.dealer_group_id != dealer_group_id:
        raise ValueError("WIP not found")

    labour_pg = await PostingGroup.find_one(
        PostingGroup.dealer_group_id == dealer_group_id,
        PostingGroup.transaction_type == "workshop_labour",
    )
    parts_pg = await PostingGroup.find_one(
        PostingGroup.dealer_group_id == dealer_group_id,
        PostingGroup.transaction_type == "parts",
    )

    customer_name = "Unknown"
    customer_email = None
    if wip.customer_id:
        customer = await Customer.get(wip.customer_id)
        if customer:
            customer_name = f"{customer.first_name} {customer.last_name}"
            customer_email = customer.email

    lines: list[InvoiceLine] = []
    line_num = 1

    for labour in wip.labour_lines:
        tax_rate = labour_pg.tax_rate if labour_pg else 20.0
        gl_code = labour_pg.revenue_gl_code if labour_pg else "4200"
        net = round(labour.total, 2)
        tax = round(net * tax_rate / 100, 2)
        lines.append(InvoiceLine(
            line_number=line_num,
            description=labour.description,
            quantity=labour.hours,
            unit_price=labour.rate,
            net_amount=net,
            tax_rate=tax_rate,
            tax_amount=tax,
            gross_amount=round(net + tax, 2),
            posting_group_type="workshop_labour",
            gl_revenue_code=gl_code,
            reference=labour.op_code,
        ))
        line_num += 1

    for part in wip.parts_lines:
        tax_rate = parts_pg.tax_rate if parts_pg else 20.0
        gl_code = parts_pg.revenue_gl_code if parts_pg else "4300"
        net = round(part.total_price, 2)
        tax = round(net * tax_rate / 100, 2)
        lines.append(InvoiceLine(
            line_number=line_num,
            description=part.description,
            quantity=part.quantity,
            unit_price=part.unit_price,
            net_amount=net,
            tax_rate=tax_rate,
            tax_amount=tax,
            gross_amount=round(net + tax, 2),
            posting_group_type="parts",
            gl_revenue_code=gl_code,
            reference=part.part_number,
        ))
        line_num += 1

    net_total = round(sum(l.net_amount for l in lines), 2)
    tax_total = round(sum(l.tax_amount for l in lines), 2)
    gross_total = round(net_total + tax_total, 2)

    invoice = Invoice(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        invoice_number=await next_invoice_number(dealer_group_id, outlet_id),
        invoice_type="workshop",
        customer_id=wip.customer_id,
        customer_name=customer_name,
        customer_email=customer_email,
        wip_id=str(wip.id),
        vehicle_registration=wip.vehicle_registration,
        vehicle_description=f"{wip.vehicle_make or ''} {wip.vehicle_model or ''}".strip() or None,
        lines=lines,
        net_total=net_total,
        tax_total=tax_total,
        gross_total=gross_total,
        status="draft",
        created_by=created_by,
    )
    await invoice.insert()
    return invoice


# ---------------------------------------------------------------------------
# Create invoice from order accessories
# ---------------------------------------------------------------------------

async def create_accessory_invoice(
    order_id: str,
    dealer_group_id: str,
    outlet_id: str,
    created_by: Optional[str] = None,
) -> Invoice:
    order = await Order.get(order_id)
    if not order or order.dealer_group_id != dealer_group_id:
        raise ValueError("Order not found")

    pg = await PostingGroup.find_one(
        PostingGroup.dealer_group_id == dealer_group_id,
        PostingGroup.transaction_type == "accessory",
    )
    tax_rate = pg.tax_rate if pg else 20.0
    gl_code = pg.revenue_gl_code if pg else "4100"

    customer_name = "Unknown"
    customer_email = None
    if order.customer_id:
        customer = await Customer.get(order.customer_id)
        if customer:
            customer_name = f"{customer.first_name} {customer.last_name}"
            customer_email = customer.email

    lines = []
    for i, acc in enumerate(order.accessory_lines, start=1):
        net = round(acc.total_price, 2)
        tax = round(net * tax_rate / 100, 2)
        lines.append(InvoiceLine(
            line_number=i,
            description=acc.description,
            quantity=acc.quantity,
            unit_price=acc.unit_price,
            net_amount=net,
            tax_rate=tax_rate,
            tax_amount=tax,
            gross_amount=round(net + tax, 2),
            posting_group_type="accessory",
            gl_revenue_code=gl_code,
            reference=acc.part_number,
        ))

    net_total = round(sum(l.net_amount for l in lines), 2)
    tax_total = round(sum(l.tax_amount for l in lines), 2)

    invoice = Invoice(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        invoice_number=await next_invoice_number(dealer_group_id, outlet_id),
        invoice_type="accessory",
        customer_id=order.customer_id,
        customer_name=customer_name,
        customer_email=customer_email,
        order_id=str(order.id),
        vehicle_description=f"{order.ordered_model} {order.ordered_derivative or ''}".strip(),
        lines=lines,
        net_total=net_total,
        tax_total=tax_total,
        gross_total=round(net_total + tax_total, 2),
        status="draft",
        created_by=created_by,
    )
    await invoice.insert()
    return invoice


# ---------------------------------------------------------------------------
# Post invoice to GL (double-entry)
# ---------------------------------------------------------------------------

async def post_to_gl(invoice_id: str, dealer_group_id: str) -> list[GLEntry]:
    invoice = await Invoice.get(invoice_id)
    if not invoice or invoice.dealer_group_id != dealer_group_id:
        raise ValueError("Invoice not found")
    if invoice.gl_posted:
        raise ValueError("Invoice already posted to GL")

    entries: list[GLEntry] = []

    for line in invoice.lines:
        # DR Trade Debtors (gross)
        entries.append(GLEntry(
            dealer_group_id=dealer_group_id,
            outlet_id=invoice.outlet_id,
            invoice_id=str(invoice.id),
            invoice_number=invoice.invoice_number,
            gl_code="2000",
            gl_name="Trade Debtors",
            entry_type="debit",
            amount=line.gross_amount,
            description=f"Invoice {invoice.invoice_number} — {line.description}",
            reference=invoice.invoice_number,
        ))
        # CR Revenue (net)
        entries.append(GLEntry(
            dealer_group_id=dealer_group_id,
            outlet_id=invoice.outlet_id,
            invoice_id=str(invoice.id),
            invoice_number=invoice.invoice_number,
            gl_code=line.gl_revenue_code,
            gl_name=f"Revenue ({line.posting_group_type})",
            entry_type="credit",
            amount=line.net_amount,
            description=f"Invoice {invoice.invoice_number} — {line.description}",
            reference=invoice.invoice_number,
        ))
        # CR VAT Control (tax)
        if line.tax_amount > 0:
            entries.append(GLEntry(
                dealer_group_id=dealer_group_id,
                outlet_id=invoice.outlet_id,
                invoice_id=str(invoice.id),
                invoice_number=invoice.invoice_number,
                gl_code="2100",
                gl_name="VAT Control",
                entry_type="credit",
                amount=line.tax_amount,
                description=f"VAT — Invoice {invoice.invoice_number}",
                reference=invoice.invoice_number,
            ))

    for entry in entries:
        await entry.insert()

    invoice.gl_posted = True
    invoice.gl_posted_at = datetime.utcnow()
    invoice.status = "posted"
    invoice.updated_at = datetime.utcnow()
    await invoice.save()

    return entries


# ---------------------------------------------------------------------------
# PDF generation (HTML → PDF via weasyprint or similar)
# ---------------------------------------------------------------------------

async def render_invoice_html(invoice_id: str, dealer_group_id: str) -> str:
    """Render the invoice as HTML using the configured template."""
    invoice = await Invoice.get(invoice_id)
    if not invoice or invoice.dealer_group_id != dealer_group_id:
        raise ValueError("Invoice not found")

    template_doc = await InvoiceTemplate.find_one(
        InvoiceTemplate.dealer_group_id == dealer_group_id,
        InvoiceTemplate.template_id == invoice.template_id,
    )

    if not template_doc:
        # Fall back to a minimal built-in template
        return _default_html(invoice)

    from jinja2 import Environment
    env = Environment(autoescape=True)
    tmpl = env.from_string(template_doc.html_template)
    return tmpl.render(invoice=invoice, dealer=template_doc)


def _default_html(invoice: Invoice) -> str:
    lines_html = "".join(
        f"<tr><td>{l.description}</td><td style='text-align:right'>{l.quantity}</td>"
        f"<td style='text-align:right'>£{l.unit_price:.2f}</td>"
        f"<td style='text-align:right'>£{l.net_amount:.2f}</td>"
        f"<td style='text-align:right'>£{l.tax_amount:.2f}</td>"
        f"<td style='text-align:right'>£{l.gross_amount:.2f}</td></tr>"
        for l in invoice.lines
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 12px; margin: 40px; }}
  h1 {{ color: #1e40af; }} table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
  th, td {{ border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }}
  th {{ background: #f9fafb; text-align: left; font-size: 11px; text-transform: uppercase; }}
  .totals {{ margin-top: 12px; text-align: right; }}
</style></head>
<body>
<h1>Invoice {invoice.invoice_number}</h1>
<p><strong>To:</strong> {invoice.customer_name}</p>
<p><strong>Date:</strong> {invoice.invoice_date.strftime('%d/%m/%Y')}</p>
{'<p><strong>Vehicle:</strong> ' + invoice.vehicle_registration + ' — ' + (invoice.vehicle_description or '') + '</p>' if invoice.vehicle_registration else ''}
<table>
<thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Net</th><th>VAT</th><th>Gross</th></tr></thead>
<tbody>{lines_html}</tbody>
</table>
<div class="totals">
  <p>Net: <strong>£{invoice.net_total:.2f}</strong></p>
  <p>VAT: <strong>£{invoice.tax_total:.2f}</strong></p>
  <p style="font-size:14px">Total: <strong>£{invoice.gross_total:.2f}</strong></p>
</div>
</body></html>"""
