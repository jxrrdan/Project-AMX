import { Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType } from '@prisma/client';
import { DocumentTemplateType, VAT_RATES, VatCode } from '@project-amx/shared';
import { PdfService } from '../../common/pdf/pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import { CONTROL_ACCOUNT_CODES } from '../ledger/ledger.constants';
import { LedgerService } from '../ledger/ledger.service';
import { CreateCustomerInvoiceDto } from './dto/customer-invoice.dto';

/** Used whenever a dealer hasn't authored their own CUSTOMER_SUPPORT_INVOICE document template. */
const DEFAULT_CUSTOMER_SUPPORT_INVOICE_TEMPLATE = `
<html><body style="font-family:sans-serif">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
{{#if dealerLogoUrl}}<img src="{{dealerLogoUrl}}" style="height:48px" />{{/if}}
<div><h1 style="margin:0">{{dealerName}}</h1><p style="margin:0;font-size:12px">{{dealerAddress}}</p></div>
</div>
<h2>Invoice {{invoiceNumber}}</h2>
<p>Customer: {{customerName}}</p>
<p>{{description}}</p>
<p>Amount: £{{amount}}</p>
<p>VAT (20%): £{{vatAmount}}</p>
<p><b>Total: £{{totalAmount}}</b></p>
{{#if dealerVatNumber}}<p style="font-size:11px;color:#666">VAT registration: {{dealerVatNumber}}</p>{{/if}}
{{#if dealerInvoiceFooterNote}}<p style="font-size:11px;color:#666">{{dealerInvoiceFooterNote}}</p>{{/if}}
</body></html>`;

/** Single source of truth for VAT rates — see VAT_RATES in @project-amx/shared. */
const VAT_RATE = VAT_RATES[VatCode.STANDARD];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ad-hoc customer-support invoicing — goodwill gestures, admin fees, lost-key/remote charges and
 * the like, raised directly against a CRM Contact rather than a workshop JobCard (that's
 * AftersalesInvoiceService). Uses the same document-template/sequence engine as every other AMX
 * document, so a dealer/franchise/group can brand it the same way. Unlike AftersalesInvoice, a
 * contact can have any number of these over time (no natural "one per X" parent to key off).
 */
@Injectable()
export class CustomerInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly documentSequences: DocumentSequenceService,
    private readonly documentTemplates: DocumentTemplatesService,
    private readonly ledgerService: LedgerService,
  ) {}

  list(dealerId: string, contactId: string) {
    return this.prisma.customerInvoice.findMany({ where: { dealerId, contactId }, orderBy: { createdAt: 'desc' } });
  }

  async create(dealerId: string, contactId: string, dto: CreateCustomerInvoiceDto) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, dealerId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const dealer = await this.prisma.dealer.findUnique({ where: { id: dealerId } });
    const amount = round2(dto.amount);
    const vatAmount = round2(amount * VAT_RATE);
    const totalAmount = round2(amount + vatAmount);

    const [invoiceNumber, templateBody] = await Promise.all([
      this.documentSequences.nextNumber(dealerId, 'CUSTOMER_SUPPORT_INVOICE'),
      this.documentTemplates.getDefaultBody(
        dealerId,
        DocumentTemplateType.CUSTOMER_SUPPORT_INVOICE,
        DEFAULT_CUSTOMER_SUPPORT_INVOICE_TEMPLATE,
      ),
    ]);

    const pdfUrl = await this.pdf.renderAndStore(dealerId, 'customer-invoices', `invoice-${contactId}-${invoiceNumber}`, templateBody, {
      invoiceNumber,
      customerName: `${contact.firstName} ${contact.lastName}`,
      description: dto.description,
      amount: amount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      documentDate: new Date().toLocaleDateString('en-GB'),
      dealerName: dealer?.name,
      dealerAddress: dealer?.address,
      dealerLogoUrl: dealer?.logoUrl,
      dealerVatNumber: dealer?.vatNumber,
      dealerInvoiceFooterNote: dealer?.invoiceFooterNote,
    });

    const invoice = await this.prisma.customerInvoice.create({
      data: { dealerId, contactId, invoiceNumber, description: dto.description, amount, vatAmount, totalAmount, pdfUrl },
    });

    // No dedicated nominal code exists for ad-hoc customer-support fees (lost keys, admin
    // charges); they're closest in kind to aftersales work, so they're booked there.
    await this.ledgerService.postSafely(dealerId, {
      reference: invoiceNumber,
      description: `Customer invoice ${invoiceNumber} — ${dto.description}`,
      sourceType: JournalSourceType.CUSTOMER_INVOICE,
      sourceId: invoice.id,
      lines: [
        { accountCode: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, debit: totalAmount },
        { accountCode: CONTROL_ACCOUNT_CODES.AFTERSALES_LABOUR, credit: amount },
        ...(vatAmount > 0 ? [{ accountCode: CONTROL_ACCOUNT_CODES.VAT_OUTPUT, credit: vatAmount, vatAmount }] : []),
      ],
    });

    return invoice;
  }
}
