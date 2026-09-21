import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionTriggerPoint, DealSheetStatus, DocumentTemplateType, UsedVehicleStatus } from '@project-amx/shared';
import { PdfService } from '../../common/pdf/pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActionTriggersService } from '../action-triggers/action-triggers.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import { TradeInService } from './trade-in.service';
import {
  AddPhotosDto,
  CreateAppraisalDto,
  CreateDealSheetDto,
  CreateUsedVehicleDto,
  InvalidateDealSheetDto,
  SetAskingPriceDto,
  UpdateUsedVehicleStatusDto,
} from './dto/used-car.dto';

/** Used whenever a dealer hasn't authored their own DEAL_SHEET document template (Settings > Document templates). */
const DEFAULT_DEAL_SHEET_TEMPLATE = `
<html><body style="font-family:sans-serif">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
{{#if dealerLogoUrl}}<img src="{{dealerLogoUrl}}" style="height:48px" />{{/if}}
<div><h1 style="margin:0">{{dealerName}}</h1><p style="margin:0;font-size:12px">{{dealerAddress}}</p></div>
</div>
<h2>Deal Sheet — {{documentNumber}}</h2>
<p>Vehicle: {{vehicle.make}} {{vehicle.model}} ({{vehicle.reg}})</p>
<p>Selling price: £{{sellingPrice}}</p>
<p>Part-exchange value: £{{partExchangeValue}}</p>
<p>Finance contribution: £{{financeContribution}}</p>
{{#if accessories.length}}
<p>Accessories:</p>
<ul>
{{#each accessories}}
<li>{{description}} — £{{price}}</li>
{{/each}}
</ul>
{{/if}}
<p>Accessories total: £{{accessoriesTotal}}</p>
<p><b>Gross profit: £{{grossProfit}}</b></p>
{{#if dealerInvoiceFooterNote}}<p style="font-size:11px;color:#666">{{dealerInvoiceFooterNote}}</p>{{/if}}
</body></html>`;

@Injectable()
export class UsedCarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly documentSequences: DocumentSequenceService,
    private readonly documentTemplates: DocumentTemplatesService,
    private readonly actionTriggers: ActionTriggersService,
    private readonly tradeInService: TradeInService,
  ) {}

  // --- Stock (§4.1) --------------------------------------------------------

  findAll(dealerId: string, status?: UsedVehicleStatus) {
    return this.prisma.usedVehicle.findMany({
      where: { dealerId, status: status || undefined },
      include: { photos: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(dealerId: string, id: string) {
    return this.prisma.usedVehicle.findFirst({
      where: { id, dealerId },
      include: {
        photos: true,
        priceHistory: true,
        appraisal: true,
        dealSheets: { orderBy: { createdAt: 'desc' }, include: { accessoryLines: true, tradeIn: true } },
        leads: true,
      },
    });
  }

  create(dealerId: string, dto: CreateUsedVehicleDto) {
    return this.prisma.usedVehicle.create({ data: { dealerId, ...dto } });
  }

  /**
   * Searches this dealer's own stock for a matching registration AND, if a business systems
   * manager has configured one (Settings > Action Triggers), calls an external OEM/DMS API with
   * the same value and returns its mapped enrichment — the concrete "search a reg, it also calls
   * an OEM API" capability. `enrichment` is advisory data for the caller to pre-fill a new record
   * with; it's never written to the database here.
   */
  async regLookup(dealerId: string, reg: string) {
    const [existingVehicle, enrichment] = await Promise.all([
      this.prisma.usedVehicle.findFirst({ where: { dealerId, reg } }),
      this.actionTriggers.run(dealerId, ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, reg),
    ]);
    return { existingVehicle, enrichment };
  }

  async updateStatus(dealerId: string, id: string, dto: UpdateUsedVehicleStatusDto) {
    const vehicle = await this.prisma.usedVehicle.findFirst({ where: { id, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }
    const updated = await this.prisma.usedVehicle.update({
      where: { id },
      data: {
        status: dto.status,
        listedAt: dto.status === UsedVehicleStatus.LISTED ? new Date() : undefined,
        soldAt: dto.status === UsedVehicleStatus.SOLD ? new Date() : undefined,
      },
    });
    // The vehicle going SOLD means whichever deal sheet was actively being worked resulted in a
    // signed sale — record that transition on the deal sheet itself so its status is meaningful,
    // not just the vehicle's.
    if (dto.status === UsedVehicleStatus.SOLD) {
      await this.prisma.dealSheet.updateMany({
        where: { usedVehicleId: id, status: DealSheetStatus.ACTIVE },
        data: { status: DealSheetStatus.SIGNED },
      });
    }
    return updated;
  }

  async addPhotos(dealerId: string, id: string, dto: AddPhotosDto) {
    const vehicle = await this.prisma.usedVehicle.findFirst({ where: { id, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }
    return this.prisma.vehiclePhoto.createMany({
      data: dto.urls.map((url, index) => ({ usedVehicleId: id, url, sortOrder: index })),
    });
  }

  // --- Pricing & valuation (§4.2) ------------------------------------------

  async setAskingPrice(dealerId: string, id: string, dto: SetAskingPriceDto) {
    const vehicle = await this.prisma.usedVehicle.findFirst({ where: { id, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }
    return this.prisma.$transaction([
      this.prisma.usedVehicle.update({ where: { id }, data: { askingPrice: dto.askingPrice } }),
      this.prisma.priceHistoryEntry.create({ data: { usedVehicleId: id, price: dto.askingPrice } }),
    ]);
  }

  /** Days-in-stock tracker with alerts at 30/60/90 days (§4.2). */
  async daysInStockAlerts(dealerId: string) {
    const vehicles = await this.prisma.usedVehicle.findMany({
      where: { dealerId, status: { in: [UsedVehicleStatus.IN_STOCK, UsedVehicleStatus.LISTED] } },
    });
    const now = Date.now();
    return vehicles
      .map((v) => ({ ...v, daysInStock: Math.floor((now - v.createdAt.getTime()) / 86400000) }))
      .filter((v) => [30, 60, 90].some((threshold) => v.daysInStock >= threshold));
  }

  // --- Part-exchange appraisal (§4.4) --------------------------------------

  async createAppraisal(dealerId: string, usedVehicleId: string, dto: CreateAppraisalDto) {
    const vehicle = await this.prisma.usedVehicle.findFirst({ where: { id: usedVehicleId, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }
    return this.prisma.partExchangeAppraisal.create({ data: { usedVehicleId, ...dto } });
  }

  // --- Deal sheet (§4.5) ----------------------------------------------------

  async createDealSheet(dealerId: string, usedVehicleId: string, dto: CreateDealSheetDto) {
    const vehicle = await this.prisma.usedVehicle.findFirst({ where: { id: usedVehicleId, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }
    const activeDealSheet = await this.prisma.dealSheet.findFirst({
      where: { usedVehicleId, status: DealSheetStatus.ACTIVE },
    });
    if (activeDealSheet) {
      throw new BadRequestException(
        'This vehicle already has an active deal sheet — invalidate it first if that deal fell through',
      );
    }

    const accessories = dto.accessories ?? [];
    const accessoriesTotal = accessories.reduce((sum, line) => sum + line.price, 0);
    // Accessories are sold on top of the vehicle price, so they add to gross profit; part-exchange
    // value is a cost already reflected in the vehicle's own purchasePrice once it's taken in, so
    // it isn't subtracted again here.
    const grossProfit = dto.sellingPrice - Number(vehicle.purchasePrice ?? 0) + accessoriesTotal;

    const [dealer, documentNumber, templateBody] = await Promise.all([
      this.prisma.dealer.findUnique({ where: { id: dealerId } }),
      this.documentSequences.nextNumber(dealerId, 'DEAL_SHEET'),
      this.documentTemplates.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, DEFAULT_DEAL_SHEET_TEMPLATE),
    ]);

    const pdfUrl = await this.pdf.renderAndStore(dealerId, 'deal-sheets', `deal-${usedVehicleId}`, templateBody, {
      vehicle,
      ...dto,
      accessories,
      accessoriesTotal: accessoriesTotal.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      documentNumber,
      documentDate: new Date().toLocaleDateString('en-GB'),
      dealerName: dealer?.name,
      dealerAddress: dealer?.address,
      dealerLogoUrl: dealer?.logoUrl,
      dealerVatNumber: dealer?.vatNumber,
      dealerInvoiceFooterNote: dealer?.invoiceFooterNote,
    });

    const dealSheet = await this.prisma.dealSheet.create({
      data: {
        usedVehicleId,
        status: DealSheetStatus.ACTIVE,
        sellingPrice: dto.sellingPrice,
        partExchangeValue: dto.tradeIn?.agreedValue ?? dto.partExchangeValue,
        financeContribution: dto.financeContribution,
        accessoriesTotal,
        grossProfit,
        pdfUrl,
        accessoryLines: { create: accessories },
      },
      include: { accessoryLines: true },
    });

    if (dto.tradeIn) {
      await this.tradeInService.intake(dealerId, dto.tradeIn, { dealSheetId: dealSheet.id });
    }

    return dealSheet;
  }

  /**
   * A deal that doesn't result in a signed sale must be invalidated (not deleted, for audit trail)
   * before this vehicle can get a new deal sheet — see the single-active-deal-sheet check in
   * createDealSheet(). Only an ACTIVE deal sheet can be invalidated: one already SIGNED represents
   * a completed sale and shouldn't be reopened this way, and an already-INVALIDATED one is a no-op.
   */
  async invalidateDealSheet(dealerId: string, usedVehicleId: string, dealSheetId: string, dto: InvalidateDealSheetDto) {
    const dealSheet = await this.prisma.dealSheet.findFirst({
      where: { id: dealSheetId, usedVehicleId, usedVehicle: { dealerId } },
    });
    if (!dealSheet) {
      throw new NotFoundException('Deal sheet not found');
    }
    if (dealSheet.status !== DealSheetStatus.ACTIVE) {
      throw new BadRequestException(`Only an active deal sheet can be invalidated (this one is ${dealSheet.status})`);
    }
    return this.prisma.dealSheet.update({
      where: { id: dealSheetId },
      data: { status: DealSheetStatus.INVALIDATED, invalidatedAt: new Date(), invalidatedReason: dto.reason },
    });
  }

  // --- Reporting (§4.7) ------------------------------------------------------

  async stockAgeingReport(dealerId: string) {
    const vehicles = await this.findAll(dealerId, UsedVehicleStatus.IN_STOCK);
    const now = Date.now();
    return vehicles.map((v) => ({
      id: v.id,
      reg: v.reg,
      daysInStock: Math.floor((now - v.createdAt.getTime()) / 86400000),
    }));
  }
}
