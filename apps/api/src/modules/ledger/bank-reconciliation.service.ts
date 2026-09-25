import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BankLineStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../dealers/document-sequence.service';
import { CONTROL_ACCOUNT_CODES } from './ledger.constants';
import { BankStatementLineInputDto } from './dto/bank-reconciliation.dto';

const MATCH_WINDOW_DAYS = 5;
const MATCH_TOLERANCE = 0.01;

/**
 * Bank statement reconciliation — matching what actually hit the bank against what the ledger
 * says should have. Every other accounting suite (Xero/Sage, and Keyloop's own accounting depth)
 * has this; this app's nominal ledger posts correctly but, on its own, has no way to catch a
 * posting that's wrong or a bank line that was never posted at all. Import is mocked (no real
 * Open Banking/bank-feed integration) — the caller supplies already-parsed CSV rows.
 */
@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentSequences: DocumentSequenceService,
  ) {}

  async importStatementLines(dealerId: string, lines: BankStatementLineInputDto[]) {
    const importBatchRef = await this.documentSequences.nextNumber(dealerId, 'BANK_IMPORT');
    const created = await this.prisma.$transaction(
      lines.map((line) =>
        this.prisma.bankStatementLine.create({
          data: { dealerId, date: new Date(line.date), description: line.description, amount: line.amount, importBatchRef },
        }),
      ),
    );

    await Promise.all(created.map((line) => this.tryAutoMatch(dealerId, line.id)));

    return this.prisma.bankStatementLine.findMany({ where: { importBatchRef, dealerId }, orderBy: { date: 'asc' } });
  }

  listBankLines(dealerId: string) {
    return this.prisma.bankStatementLine.findMany({
      where: { dealerId },
      include: { matchedJournalLine: { include: { journalEntry: true } } },
      orderBy: { date: 'desc' },
    });
  }

  /** Unmatched Bank-account postings a bank line could be matched against — the pick-list for
   * manual matching in the UI. */
  listUnmatchedJournalLines(dealerId: string) {
    return this.prisma.journalLine.findMany({
      where: { account: { dealerId, code: CONTROL_ACCOUNT_CODES.BANK }, matchedByBankStatementLine: null },
      include: { journalEntry: true, account: true },
      orderBy: { journalEntry: { date: 'desc' } },
    });
  }

  async matchManually(dealerId: string, bankLineId: string, journalLineId: string) {
    const bankLine = await this.prisma.bankStatementLine.findFirst({ where: { id: bankLineId, dealerId } });
    if (!bankLine) {
      throw new NotFoundException('Bank statement line not found');
    }
    const journalLine = await this.prisma.journalLine.findFirst({
      where: { id: journalLineId, account: { dealerId, code: CONTROL_ACCOUNT_CODES.BANK } },
      include: { matchedByBankStatementLine: true },
    });
    if (!journalLine) {
      throw new NotFoundException('Journal line not found');
    }
    if (journalLine.matchedByBankStatementLine) {
      throw new BadRequestException('That journal line is already matched to a different bank statement line');
    }

    return this.prisma.bankStatementLine.update({
      where: { id: bankLineId },
      data: { status: BankLineStatus.MATCHED, matchedJournalLineId: journalLineId },
    });
  }

  async unmatch(dealerId: string, bankLineId: string) {
    const bankLine = await this.prisma.bankStatementLine.findFirst({ where: { id: bankLineId, dealerId } });
    if (!bankLine) {
      throw new NotFoundException('Bank statement line not found');
    }
    return this.prisma.bankStatementLine.update({ where: { id: bankLineId }, data: { status: BankLineStatus.UNMATCHED, matchedJournalLineId: null } });
  }

  /** Money in (positive) matches a debit on the Bank account; money out (negative) matches a
   * credit — automatically, only when exactly one unmatched candidate exists within the date
   * window and tolerance, so an ambiguous case is left for a human to pick manually rather than
   * guessed at. */
  private async tryAutoMatch(dealerId: string, bankLineId: string) {
    const bankLine = await this.prisma.bankStatementLine.findUniqueOrThrow({ where: { id: bankLineId } });
    const amount = Math.abs(Number(bankLine.amount));
    const from = new Date(bankLine.date);
    from.setDate(from.getDate() - MATCH_WINDOW_DAYS);
    const to = new Date(bankLine.date);
    to.setDate(to.getDate() + MATCH_WINDOW_DAYS);

    const candidates = await this.prisma.journalLine.findMany({
      where: {
        account: { dealerId, code: CONTROL_ACCOUNT_CODES.BANK },
        matchedByBankStatementLine: null,
        journalEntry: { date: { gte: from, lte: to } },
      },
      include: { journalEntry: true },
    });

    const matches = candidates.filter((line) => {
      const side = Number(bankLine.amount) >= 0 ? Number(line.debit) : Number(line.credit);
      return Math.abs(side - amount) <= MATCH_TOLERANCE;
    });

    if (matches.length === 1) {
      await this.prisma.bankStatementLine.update({
        where: { id: bankLineId },
        data: { status: BankLineStatus.MATCHED, matchedJournalLineId: matches[0].id },
      });
    }
  }
}
