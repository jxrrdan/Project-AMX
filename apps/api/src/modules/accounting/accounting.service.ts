import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountingSyncStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateIntegrationDto, CreateTransactionDto } from './dto/accounting.dto';

/**
 * Module 11 — accounting integration. Xero/QuickBooks API calls and the Sage CSV/XML export are
 * mocked: `sync()` marks the transaction Synced immediately. Swap in the real provider client
 * behind ACCOUNTING_DRIVER for production (see StorageService/EmailService for the pattern).
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  listIntegrations(dealerId: string) {
    return this.prisma.accountingIntegration.findMany({ where: { dealerId } });
  }

  createIntegration(dealerId: string, dto: CreateIntegrationDto) {
    return this.prisma.accountingIntegration.create({ data: { dealerId, ...dto } });
  }

  /** Chart of accounts mapping — AMS transaction types to the dealer's nominal codes (§11.3). */
  updateMapping(integrationId: string, accountMappings: Record<string, string>) {
    return this.prisma.accountingIntegration.update({ where: { id: integrationId }, data: { accountMappings } });
  }

  createTransaction(dto: CreateTransactionDto) {
    return this.prisma.accountingTransaction.create({ data: dto });
  }

  listTransactions(dealerId: string) {
    return this.prisma.accountingTransaction.findMany({
      where: { integration: { dealerId } },
      include: { integration: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Auto-sync on invoice creation, or batch export on demand (§11.4). */
  async sync(id: string) {
    const txn = await this.prisma.accountingTransaction.findUnique({ where: { id } });
    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    this.logger.log(`[accounting mock sync] ${txn.type} ${txn.amount} → provider`);
    return this.prisma.accountingTransaction.update({
      where: { id },
      data: { status: AccountingSyncStatus.SYNCED, syncedAt: new Date() },
    });
  }

  /** Reconciliation report: AMS totals vs. accounting system totals for a period (§11.4). */
  async reconciliation(dealerId: string, from: Date, to: Date) {
    const transactions = await this.prisma.accountingTransaction.findMany({
      where: { integration: { dealerId }, createdAt: { gte: from, lte: to } },
    });
    const amsTotal = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const syncedTotal = transactions
      .filter((t) => t.status === AccountingSyncStatus.SYNCED)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { amsTotal, syncedTotal, difference: amsTotal - syncedTotal };
  }
}
