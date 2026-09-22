import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalSourceType, ManufacturerPaymentBatchStatus, WarrantyClaimStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CONTROL_ACCOUNT_CODES } from '../ledger/ledger.constants';
import { LedgerService } from '../ledger/ledger.service';
import { CreateManufacturerPaymentBatchDto } from './dto/manufacturer-payment.dto';

const DISCREPANCY_TOLERANCE = 0.01;

@Injectable()
export class ManufacturerPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  listBatches(dealerId: string) {
    return this.prisma.manufacturerPaymentBatch.findMany({
      where: { dealerId },
      include: { supplier: true, lines: { include: { warrantyClaim: true } } },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async createBatch(dealerId: string, dto: CreateManufacturerPaymentBatchDto) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, dealerId } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const claimIds = dto.lines.map((line) => line.warrantyClaimId).filter((id): id is string => !!id);
    if (claimIds.length) {
      const claims = await this.prisma.warrantyClaim.findMany({ where: { id: { in: claimIds }, dealerId } });
      if (claims.length !== new Set(claimIds).size) {
        throw new BadRequestException('One or more warranty claims do not belong to this dealer');
      }
    }

    const totalAmount = dto.lines.reduce((sum, line) => sum + line.amount, 0);
    return this.prisma.manufacturerPaymentBatch.create({
      data: {
        dealerId,
        supplierId: dto.supplierId,
        batchReference: dto.batchReference,
        isSelfBill: dto.isSelfBill ?? true,
        remittanceUrl: dto.remittanceUrl,
        totalAmount,
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  async findBatch(dealerId: string, id: string) {
    const batch = await this.prisma.manufacturerPaymentBatch.findFirst({
      where: { id, dealerId },
      include: { supplier: true, lines: { include: { warrantyClaim: true } } },
    });
    if (!batch) {
      throw new NotFoundException('Manufacturer payment batch not found');
    }
    return batch;
  }

  /** Reconciles each line against its WarrantyClaim.expectedPayment, flagging mismatches rather
   * than silently accepting whatever the manufacturer's remittance says was paid. */
  async reconcileBatch(dealerId: string, id: string) {
    const batch = await this.findBatch(dealerId, id);

    let anyDiscrepancy = false;
    await this.prisma.$transaction(
      batch.lines
        .filter((line) => line.warrantyClaim?.expectedPayment != null)
        .map((line) => {
          const discrepancy = Number(line.amount) - Number(line.warrantyClaim?.expectedPayment ?? 0);
          if (Math.abs(discrepancy) > DISCREPANCY_TOLERANCE) {
            anyDiscrepancy = true;
          }
          return this.prisma.manufacturerPaymentBatchLine.update({
            where: { id: line.id },
            data: { discrepancy: Math.abs(discrepancy) > DISCREPANCY_TOLERANCE ? discrepancy : null },
          });
        }),
    );

    return this.prisma.manufacturerPaymentBatch.update({
      where: { id },
      data: { status: anyDiscrepancy ? ManufacturerPaymentBatchStatus.DISCREPANCY : ManufacturerPaymentBatchStatus.RECONCILED },
      include: { lines: true },
    });
  }

  /** Posts one consolidated journal entry for the whole batch and settles every matched
   * WarrantyClaim to PAID — the "bulk manufacturer/warranty payment processing" the batch exists for. */
  async postBatch(dealerId: string, id: string) {
    const batch = await this.findBatch(dealerId, id);
    if (batch.status === ManufacturerPaymentBatchStatus.RECEIVED) {
      throw new BadRequestException('Reconcile the batch before posting it');
    }
    if (batch.status === ManufacturerPaymentBatchStatus.POSTED) {
      throw new BadRequestException('Batch has already been posted');
    }

    await this.ledgerService.post(dealerId, {
      reference: batch.batchReference,
      description: `Manufacturer payment batch ${batch.batchReference} — ${batch.supplier.name}`,
      sourceType: JournalSourceType.MANUFACTURER_PAYMENT,
      sourceId: batch.id,
      lines: [
        { accountCode: CONTROL_ACCOUNT_CODES.BANK, debit: Number(batch.totalAmount) },
        { accountCode: CONTROL_ACCOUNT_CODES.MANUFACTURER_WARRANTY_INCOME, credit: Number(batch.totalAmount) },
      ],
    });

    await Promise.all(
      batch.lines
        .filter((line): line is typeof line & { warrantyClaimId: string } => !!line.warrantyClaimId)
        .map((line) =>
          this.prisma.warrantyClaim.update({
            where: { id: line.warrantyClaimId },
            data: { status: WarrantyClaimStatus.PAID, actualPayment: line.amount },
          }),
        ),
    );

    return this.prisma.manufacturerPaymentBatch.update({
      where: { id },
      data: { status: ManufacturerPaymentBatchStatus.POSTED, postedAt: new Date() },
    });
  }
}
