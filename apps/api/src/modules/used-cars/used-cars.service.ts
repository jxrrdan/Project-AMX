import { Injectable, NotFoundException } from '@nestjs/common';
import { UsedVehicleStatus } from '@project-amx/shared';
import { PdfService } from '../../common/pdf/pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AddPhotosDto,
  CreateAppraisalDto,
  CreateDealSheetDto,
  CreateUsedVehicleDto,
  SetAskingPriceDto,
  UpdateUsedVehicleStatusDto,
} from './dto/used-car.dto';

const DEAL_SHEET_TEMPLATE = `
<html><body style="font-family:sans-serif">
<h1>Deal Sheet</h1>
<p>Vehicle: {{vehicle.make}} {{vehicle.model}} ({{vehicle.reg}})</p>
<p>Selling price: £{{sellingPrice}}</p>
<p>Part-exchange value: £{{partExchangeValue}}</p>
<p>Finance contribution: £{{financeContribution}}</p>
<p>Accessories: £{{accessoriesTotal}}</p>
<p><b>Gross profit: £{{grossProfit}}</b></p>
</body></html>`;

@Injectable()
export class UsedCarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
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
      include: { photos: true, priceHistory: true, appraisal: true, dealSheet: true, leads: true },
    });
  }

  create(dealerId: string, dto: CreateUsedVehicleDto) {
    return this.prisma.usedVehicle.create({ data: { dealerId, ...dto } });
  }

  async updateStatus(dealerId: string, id: string, dto: UpdateUsedVehicleStatusDto) {
    const vehicle = await this.prisma.usedVehicle.findFirst({ where: { id, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Used vehicle not found');
    }
    return this.prisma.usedVehicle.update({
      where: { id },
      data: {
        status: dto.status,
        listedAt: dto.status === UsedVehicleStatus.LISTED ? new Date() : undefined,
        soldAt: dto.status === UsedVehicleStatus.SOLD ? new Date() : undefined,
      },
    });
  }

  addPhotos(dealerId: string, id: string, dto: AddPhotosDto) {
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
    const grossProfit = dto.sellingPrice - Number(vehicle.purchasePrice ?? 0);

    const pdfUrl = await this.pdf.renderAndStore(dealerId, 'deal-sheets', `deal-${usedVehicleId}`, DEAL_SHEET_TEMPLATE, {
      vehicle,
      ...dto,
      grossProfit: grossProfit.toFixed(2),
    });

    return this.prisma.dealSheet.create({
      data: { usedVehicleId, ...dto, grossProfit, pdfUrl },
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
