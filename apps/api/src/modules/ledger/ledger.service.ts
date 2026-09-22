import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JournalSourceType, NominalAccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CONTROL_ACCOUNT_CODES, DEFAULT_CHART_OF_ACCOUNTS } from './ledger.constants';
import { CreateNominalAccountDto, PostJournalDto } from './dto/ledger.dto';

export interface PostJournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  vatCode?: Prisma.JournalLineCreateInput['vatCode'];
  vatAmount?: number;
  description?: string;
}

export interface PostJournalInput {
  reference: string;
  description: string;
  date?: Date | string;
  sourceType?: JournalSourceType;
  sourceId?: string;
  createdById?: string;
  lines: PostJournalLineInput[];
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Lazily seeds the standard chart of accounts the first time a dealer touches the ledger. */
  async ensureChartOfAccounts(dealerId: string) {
    const count = await this.prisma.nominalAccount.count({ where: { dealerId } });
    if (count > 0) {
      return;
    }
    await this.prisma.nominalAccount.createMany({
      data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({ dealerId, ...account })),
    });
  }

  /** The single entry point for creating a balanced double-entry journal — every auto-posting
   * hook in this app (aftersales, CRM, sales, warranty, purchase ledger) must call this rather
   * than writing JournalEntry/JournalLine rows directly. */
  async post(dealerId: string, input: PostJournalInput) {
    const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new BadRequestException(`Journal entry does not balance: debit ${totalDebit.toFixed(2)} vs credit ${totalCredit.toFixed(2)}`);
    }

    await this.ensureChartOfAccounts(dealerId);

    const codes = [...new Set(input.lines.map((line) => line.accountCode))];
    const accounts = await this.prisma.nominalAccount.findMany({ where: { dealerId, code: { in: codes } } });
    const accountByCode = new Map(accounts.map((account) => [account.code, account]));
    for (const code of codes) {
      if (!accountByCode.has(code)) {
        throw new BadRequestException(`Unknown nominal account code: ${code}`);
      }
    }

    return this.prisma.journalEntry.create({
      data: {
        dealerId,
        reference: input.reference,
        description: input.description,
        date: input.date ? new Date(input.date) : new Date(),
        sourceType: input.sourceType ?? JournalSourceType.MANUAL,
        sourceId: input.sourceId,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((line) => {
            const account = accountByCode.get(line.accountCode);
            if (!account) {
              throw new BadRequestException(`Unknown nominal account code: ${line.accountCode}`);
            }
            return {
              accountId: account.id,
              debit: line.debit ?? 0,
              credit: line.credit ?? 0,
              vatCode: line.vatCode,
              vatAmount: line.vatAmount,
              description: line.description,
            };
          }),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  postManual(dealerId: string, dto: PostJournalDto, createdById?: string) {
    return this.post(dealerId, { ...dto, createdById });
  }

  /** For auto-posting hooks fired as a side effect of a revenue/warranty operation (invoicing,
   * vehicle sales) — a bug in the ledger posting must never block the primary business action
   * (issuing the invoice, recording the sale), so failures are logged rather than thrown. */
  async postSafely(dealerId: string, input: PostJournalInput): Promise<void> {
    try {
      await this.post(dealerId, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Auto-posting failed for dealer ${dealerId} (${input.sourceType ?? 'MANUAL'} ${input.sourceId ?? ''}): ${message}`);
    }
  }

  async listAccounts(dealerId: string) {
    await this.ensureChartOfAccounts(dealerId);
    return this.prisma.nominalAccount.findMany({ where: { dealerId }, orderBy: { code: 'asc' } });
  }

  createAccount(dealerId: string, dto: CreateNominalAccountDto) {
    return this.prisma.nominalAccount.create({ data: { dealerId, ...dto } });
  }

  listJournal(dealerId: string, from?: string, to?: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        dealerId,
        date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
      },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
  }

  private ledgerByAccountCode(dealerId: string, code: string, from?: string, to?: string) {
    return this.prisma.journalLine.findMany({
      where: {
        account: { dealerId, code },
        journalEntry: {
          date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
        },
      },
      include: { journalEntry: true, account: true },
      orderBy: { journalEntry: { date: 'desc' } },
    });
  }

  /** Debtors Control postings — every dealer sale/invoice that touches "the customer owes us". */
  salesLedger(dealerId: string, from?: string, to?: string) {
    return this.ledgerByAccountCode(dealerId, CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, from, to);
  }

  /** Creditors Control postings — every supplier/OEM invoice that touches "we owe them". */
  purchaseLedger(dealerId: string, from?: string, to?: string) {
    return this.ledgerByAccountCode(dealerId, CONTROL_ACCOUNT_CODES.CREDITORS_CONTROL, from, to);
  }

  /** Vehicle Stock postings — vehicle purchases/sales moving stock value in and out. */
  vehicleLedger(dealerId: string, from?: string, to?: string) {
    return this.ledgerByAccountCode(dealerId, CONTROL_ACCOUNT_CODES.VEHICLE_STOCK, from, to);
  }

  /** Computes a UK VAT100-style return for a period without persisting it — a preview before save/submit. */
  async computeVatReturn(dealerId: string, periodStart: string, periodEnd: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        account: { dealerId },
        journalEntry: { date: { gte: new Date(periodStart), lte: new Date(periodEnd) } },
      },
      include: { account: true },
    });

    const sum = (predicate: (line: (typeof lines)[number]) => boolean, pick: (line: (typeof lines)[number]) => number) =>
      lines.filter(predicate).reduce((total, line) => total + pick(line), 0);

    const box1VatDueSales = sum((l) => l.account.code === CONTROL_ACCOUNT_CODES.VAT_OUTPUT, (l) => Number(l.vatAmount ?? 0));
    const box3TotalVatDue = box1VatDueSales;
    const box4VatReclaimed = sum((l) => l.account.code === CONTROL_ACCOUNT_CODES.VAT_INPUT, (l) => Number(l.vatAmount ?? 0));
    const box5NetVatDue = box3TotalVatDue - box4VatReclaimed;
    const box6TotalSalesExVat = sum(
      (l) => l.account.type === NominalAccountType.INCOME,
      (l) => Number(l.credit) - Number(l.debit),
    );
    const box7TotalPurchasesExVat = sum(
      (l) => l.account.type === NominalAccountType.EXPENSE,
      (l) => Number(l.debit) - Number(l.credit),
    );

    return {
      periodStart,
      periodEnd,
      box1VatDueSales,
      box2VatDueAcquisitions: 0,
      box3TotalVatDue,
      box4VatReclaimed,
      box5NetVatDue,
      box6TotalSalesExVat,
      box7TotalPurchasesExVat,
      box8TotalSuppliesExVat: 0,
      box9TotalAcquisitionsExVat: 0,
    };
  }

  async saveVatReturn(dealerId: string, periodStart: string, periodEnd: string) {
    const computed = await this.computeVatReturn(dealerId, periodStart, periodEnd);
    return this.prisma.vatReturn.upsert({
      where: { dealerId_periodStart_periodEnd: { dealerId, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) } },
      create: { dealerId, ...computed, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) },
      update: { ...computed, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) },
    });
  }

  listVatReturns(dealerId: string) {
    return this.prisma.vatReturn.findMany({ where: { dealerId }, orderBy: { periodStart: 'desc' } });
  }
}
