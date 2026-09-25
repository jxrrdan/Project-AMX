import { Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CONTROL_ACCOUNT_CODES } from '../ledger/ledger.constants';
import { LedgerService } from '../ledger/ledger.service';
import { AddDealProductDto, CreateFinanceProductDto, RecordDisclosureDto } from './dto/fi.dto';

/** Module 13 — Finance & Insurance, with FCA-compliant commission disclosure tracking. */
@Injectable()
export class FiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  listProducts(dealerId: string) {
    return this.prisma.financeProduct.findMany({ where: { dealerId, active: true } });
  }

  createProduct(dealerId: string, dto: CreateFinanceProductDto) {
    return this.prisma.financeProduct.create({ data: { dealerId, ...dto } });
  }

  /** Commission total calculated automatically from the product's commission rate (§13.2). */
  async addToDeal(dealerId: string, dto: AddDealProductDto) {
    const product = await this.prisma.financeProduct.findFirst({ where: { id: dto.productId, dealerId } });
    if (!product) {
      throw new NotFoundException('Finance product not found');
    }
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, dealerId } });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
    }
    if (dto.usedVehicleId) {
      const usedVehicle = await this.prisma.usedVehicle.findFirst({ where: { id: dto.usedVehicleId, dealerId } });
      if (!usedVehicle) {
        throw new NotFoundException('Used vehicle not found');
      }
    }

    const base = dto.totalPremium ?? dto.amountFinanced ?? 0;
    const commissionAmount = product.commissionFixed
      ? Number(product.commissionFixed)
      : product.commissionRate
        ? (base * Number(product.commissionRate)) / 100
        : 0;

    const dealFinanceProduct = await this.prisma.dealFinanceProduct.create({ data: { ...dto, commissionAmount } });

    if (commissionAmount > 0) {
      await this.ledgerService.postSafely(dealerId, {
        reference: dealFinanceProduct.id,
        description: `F&I commission — ${product.name}`,
        sourceType: JournalSourceType.FI_COMMISSION,
        sourceId: dealFinanceProduct.id,
        lines: [
          { accountCode: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, debit: commissionAmount },
          { accountCode: CONTROL_ACCOUNT_CODES.FI_COMMISSION, credit: commissionAmount },
        ],
      });
    }

    return dealFinanceProduct;
  }

  /** FCA disclosure log — customer informed of commission, consent captured digitally (§13.3). */
  async recordDisclosure(dealerId: string, dealFinanceProductId: string, dto: RecordDisclosureDto) {
    const dealFinanceProduct = await this.prisma.dealFinanceProduct.findFirst({
      where: { id: dealFinanceProductId, product: { dealerId } },
    });
    if (!dealFinanceProduct) {
      throw new NotFoundException('Deal finance product not found');
    }
    return this.prisma.fcaDisclosure.create({
      data: {
        dealFinanceProductId,
        commissionDisclosed: dto.commissionDisclosed,
        customerSignatureUrl: dto.customerSignatureUrl,
        vulnerableCustomerFlag: dto.vulnerableCustomerFlag ?? false,
        customerConsentAt: new Date(),
      },
    });
  }

  // --- Reporting (§13.4) -----------------------------------------------------

  async commissionReport(dealerId: string) {
    const deals = await this.prisma.dealFinanceProduct.findMany({
      where: { product: { dealerId } },
      include: { product: true },
    });
    const totalCommission = deals.reduce((sum, d) => sum + Number(d.commissionAmount ?? 0), 0);
    const financePenetration = deals.filter((d) => d.product.type === 'FINANCE').length;
    const insuranceAttachment = deals.filter((d) => d.product.type === 'INSURANCE').length;
    return { totalCommission, dealCount: deals.length, financePenetration, insuranceAttachment };
  }
}
