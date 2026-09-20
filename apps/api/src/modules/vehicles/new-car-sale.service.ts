import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealSheetStatus, DocumentTemplateType, SaleModel } from '@project-amx/shared';
import { PdfService } from '../../common/pdf/pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import { TradeInService } from '../used-cars/trade-in.service';
import { CreateNewCarSaleDto, InvalidateNewCarSaleDto } from './dto/new-car-sale.dto';

/** Used whenever a dealer hasn't authored their own NEW_CAR_SALE document template. */
const DEFAULT_NEW_CAR_SALE_TEMPLATE = `
<html><body style="font-family:sans-serif">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
{{#if dealerLogoUrl}}<img src="{{dealerLogoUrl}}" style="height:48px" />{{/if}}
<div><h1 style="margin:0">{{dealerName}}</h1><p style="margin:0;font-size:12px">{{dealerAddress}}</p></div>
</div>
<h2>New Vehicle Sale — {{documentNumber}}</h2>
<p>Vehicle: {{vehicle.model}} (VIN {{vehicle.vin}})</p>
<p>Customer: {{vehicle.customerName}}</p>
{{#if isAgency}}
<p><b>Agency sale</b> — {{dealerName}} facilitated this sale on behalf of the manufacturer, who is the contracting seller.</p>
<p>Selling price (manufacturer contract): £{{sellingPrice}}</p>
<p>Agency commission: £{{agencyCommission}}</p>
{{else}}
<p>Selling price: £{{sellingPrice}}</p>
{{/if}}
{{#if partExchangeValue}}<p>Part-exchange value: £{{partExchangeValue}}</p>{{/if}}
{{#if dealerInvoiceFooterNote}}<p style="font-size:11px;color:#666">{{dealerInvoiceFooterNote}}</p>{{/if}}
</body></html>`;

/**
 * A new-car sale, RETAIL (the dealer buys/sells and keeps its own margin) or AGENCY (the OEM is
 * the contracting seller; the dealer facilitates and earns a commission instead). A trade-in the
 * customer brings in is always the dealer's own purchase either way — see TradeInService — so it's
 * handled identically to a used-car deal sheet's trade-in.
 */
@Injectable()
export class NewCarSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly documentSequences: DocumentSequenceService,
    private readonly documentTemplates: DocumentTemplatesService,
    private readonly tradeInService: TradeInService,
  ) {}

  async create(dealerId: string, vehicleId: string, dto: CreateNewCarSaleDto) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    const activeSale = await this.prisma.newCarSale.findFirst({ where: { vehicleId, status: DealSheetStatus.ACTIVE } });
    if (activeSale) {
      throw new BadRequestException('This vehicle already has an active sale — invalidate it first if that sale fell through');
    }
    if (dto.saleModel === SaleModel.RETAIL && dto.agencyCommission != null) {
      throw new BadRequestException('agencyCommission only applies to an AGENCY sale');
    }

    const dealer = await this.prisma.dealer.findUnique({ where: { id: dealerId } });
    const partExchangeValue = dto.tradeIn?.agreedValue;

    const [documentNumber, templateBody] = await Promise.all([
      this.documentSequences.nextNumber(dealerId, 'NEW_CAR_SALE'),
      this.documentTemplates.getDefaultBody(dealerId, DocumentTemplateType.NEW_CAR_SALE, DEFAULT_NEW_CAR_SALE_TEMPLATE),
    ]);

    const pdfUrl = await this.pdf.renderAndStore(dealerId, 'new-car-sales', `sale-${vehicleId}-${documentNumber}`, templateBody, {
      vehicle,
      documentNumber,
      isAgency: dto.saleModel === SaleModel.AGENCY,
      sellingPrice: dto.sellingPrice.toFixed(2),
      agencyCommission: dto.agencyCommission?.toFixed(2),
      partExchangeValue: partExchangeValue?.toFixed(2),
      documentDate: new Date().toLocaleDateString('en-GB'),
      dealerName: dealer?.name,
      dealerAddress: dealer?.address,
      dealerLogoUrl: dealer?.logoUrl,
      dealerVatNumber: dealer?.vatNumber,
      dealerInvoiceFooterNote: dealer?.invoiceFooterNote,
    });

    const sale = await this.prisma.newCarSale.create({
      data: {
        dealerId,
        vehicleId,
        status: DealSheetStatus.ACTIVE,
        saleModel: dto.saleModel,
        sellingPrice: dto.sellingPrice,
        agencyCommission: dto.agencyCommission,
        partExchangeValue,
        pdfUrl,
      },
    });

    if (dto.tradeIn) {
      await this.tradeInService.intake(dealerId, dto.tradeIn, { newCarSaleId: sale.id });
    }

    return sale;
  }

  list(dealerId: string, vehicleId: string) {
    return this.prisma.newCarSale.findMany({
      where: { dealerId, vehicleId },
      include: { tradeIn: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invalidate(dealerId: string, vehicleId: string, saleId: string, dto: InvalidateNewCarSaleDto) {
    const sale = await this.prisma.newCarSale.findFirst({ where: { id: saleId, vehicleId, dealerId } });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    if (sale.status !== DealSheetStatus.ACTIVE) {
      throw new BadRequestException(`Only an active sale can be invalidated (this one is ${sale.status})`);
    }
    return this.prisma.newCarSale.update({
      where: { id: saleId },
      data: { status: DealSheetStatus.INVALIDATED, invalidatedAt: new Date(), invalidatedReason: dto.reason },
    });
  }
}
