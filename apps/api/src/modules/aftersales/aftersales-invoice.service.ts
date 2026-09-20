import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentTemplateType } from '@project-amx/shared';
import { PdfService } from '../../common/pdf/pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';

/** Used whenever a dealer hasn't authored their own AFTERSALES_INVOICE document template. */
const DEFAULT_AFTERSALES_INVOICE_TEMPLATE = `
<html><body style="font-family:sans-serif">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
{{#if dealerLogoUrl}}<img src="{{dealerLogoUrl}}" style="height:48px" />{{/if}}
<div><h1 style="margin:0">{{dealerName}}</h1><p style="margin:0;font-size:12px">{{dealerAddress}}</p></div>
</div>
<h2>Invoice {{invoiceNumber}}</h2>
<p>Customer: {{customerName}}</p>
<p>Vehicle: {{vehicleReg}}</p>
<p>Job type: {{jobType}}</p>
<p>Labour: £{{labourTotal}}</p>
{{#if parts.length}}
<p>Parts:</p>
<ul>
{{#each parts}}
<li>{{description}} x{{quantity}} — £{{price}}</li>
{{/each}}
</ul>
{{/if}}
<p>Parts total: £{{partsTotal}}</p>
<p>VAT (20%): £{{vatAmount}}</p>
<p><b>Total: £{{totalAmount}}</b></p>
{{#if dealerVatNumber}}<p style="font-size:11px;color:#666">VAT registration: {{dealerVatNumber}}</p>{{/if}}
{{#if dealerInvoiceFooterNote}}<p style="font-size:11px;color:#666">{{dealerInvoiceFooterNote}}</p>{{/if}}
</body></html>`;

const VAT_RATE = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates a customer-facing invoice for a completed workshop job — labour (from actual clocked
 * time, falling back to the job's estimate if nobody clocked on/off) plus parts (from
 * PartAllocation, at cost price — this app has no separate retail parts pricing model) plus VAT.
 * Uses the same document-template system as the used-car deal sheet (§ Document templates), so a
 * dealer/franchise/group can brand it the same way.
 */
@Injectable()
export class AftersalesInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly documentSequences: DocumentSequenceService,
    private readonly documentTemplates: DocumentTemplatesService,
  ) {}

  async generate(dealerId: string, jobCardId: string) {
    const jobCard = await this.prisma.jobCard.findFirst({
      where: { id: jobCardId, dealerId },
      include: { timeEntries: true, partAllocations: { include: { part: true } } },
    });
    if (!jobCard) {
      throw new NotFoundException('Job card not found');
    }

    const existing = await this.prisma.aftersalesInvoice.findUnique({ where: { jobCardId } });
    if (existing) {
      throw new BadRequestException('An invoice has already been generated for this job card');
    }

    const dealer = await this.prisma.dealer.findUnique({ where: { id: dealerId } });

    const clockedHours = jobCard.timeEntries.reduce((sum, entry) => {
      if (!entry.clockOff) return sum;
      return sum + (entry.clockOff.getTime() - entry.clockOn.getTime()) / 3_600_000;
    }, 0);
    const hours = clockedHours > 0 ? clockedHours : Number(jobCard.estimatedHours);
    const labourRate = Number(dealer?.labourRatePerHour ?? 95);
    const labourTotal = round2(hours * labourRate);

    const partLines = jobCard.partAllocations.map((allocation) => ({
      description: allocation.part.description,
      quantity: allocation.quantity,
      price: Number(allocation.part.costPrice),
    }));
    const partsTotal = round2(partLines.reduce((sum, line) => sum + line.quantity * line.price, 0));
    const vatAmount = round2((labourTotal + partsTotal) * VAT_RATE);
    const totalAmount = round2(labourTotal + partsTotal + vatAmount);

    const [invoiceNumber, templateBody] = await Promise.all([
      this.documentSequences.nextNumber(dealerId, 'AFTERSALES_INVOICE'),
      this.documentTemplates.getDefaultBody(dealerId, DocumentTemplateType.AFTERSALES_INVOICE, DEFAULT_AFTERSALES_INVOICE_TEMPLATE),
    ]);

    const pdfUrl = await this.pdf.renderAndStore(dealerId, 'aftersales-invoices', `invoice-${jobCardId}`, templateBody, {
      invoiceNumber,
      customerName: jobCard.customerName,
      vehicleReg: jobCard.vehicleReg,
      jobType: jobCard.jobType,
      labourTotal: labourTotal.toFixed(2),
      parts: partLines.map((line) => ({ ...line, price: line.price.toFixed(2) })),
      partsTotal: partsTotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      documentDate: new Date().toLocaleDateString('en-GB'),
      dealerName: dealer?.name,
      dealerAddress: dealer?.address,
      dealerLogoUrl: dealer?.logoUrl,
      dealerVatNumber: dealer?.vatNumber,
      dealerInvoiceFooterNote: dealer?.invoiceFooterNote,
    });

    return this.prisma.aftersalesInvoice.create({
      data: { dealerId, jobCardId, invoiceNumber, labourTotal, partsTotal, vatAmount, totalAmount, pdfUrl },
    });
  }

  async get(dealerId: string, jobCardId: string) {
    const invoice = await this.prisma.aftersalesInvoice.findFirst({ where: { jobCardId, dealerId } });
    if (!invoice) {
      throw new NotFoundException('No invoice has been generated for this job card yet');
    }
    return invoice;
  }
}
