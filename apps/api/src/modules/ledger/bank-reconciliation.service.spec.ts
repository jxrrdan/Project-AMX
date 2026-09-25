import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BankLineStatus } from '@prisma/client';
import { BankReconciliationService } from './bank-reconciliation.service';

function makeDocumentSequences() {
  return { nextNumber: jest.fn().mockResolvedValue('BANK-2026-00001') };
}

describe('BankReconciliationService.importStatementLines', () => {
  it('creates a bank statement line per row under one import batch reference', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `line-${data.description}`, ...data }));
    const prisma = {
      bankStatementLine: {
        create,
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id, date: new Date('2026-09-01'), amount: 120 })),
      },
      journalLine: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);

    await service.importStatementLines('dealer-1', [
      { date: '2026-09-01', description: 'Card payment received', amount: 120 },
      { date: '2026-09-02', description: 'Supplier payment', amount: -60 },
    ]);

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dealerId: 'dealer-1', importBatchRef: 'BANK-2026-00001', amount: 120 }) }),
    );
  });
});

describe('BankReconciliationService auto-matching (via importStatementLines)', () => {
  it('auto-matches when exactly one candidate journal line matches amount and date window', async () => {
    const createdLine = { id: 'bank-line-1', date: new Date('2026-09-01'), amount: 120 };
    const update = jest.fn();
    const prisma = {
      bankStatementLine: {
        create: jest.fn().mockResolvedValue(createdLine),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdLine),
        findMany: jest.fn().mockResolvedValue([]),
        update,
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([{ id: 'jl-1', debit: 120, credit: 0, journalEntry: { date: new Date('2026-09-01') } }]),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);

    await service.importStatementLines('dealer-1', [{ date: '2026-09-01', description: 'Card payment', amount: 120 }]);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'bank-line-1' },
      data: { status: BankLineStatus.MATCHED, matchedJournalLineId: 'jl-1' },
    });
  });

  it('leaves the line unmatched when there are two equally-valid candidates', async () => {
    const createdLine = { id: 'bank-line-1', date: new Date('2026-09-01'), amount: 120 };
    const update = jest.fn();
    const prisma = {
      bankStatementLine: {
        create: jest.fn().mockResolvedValue(createdLine),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdLine),
        findMany: jest.fn().mockResolvedValue([]),
        update,
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'jl-1', debit: 120, credit: 0, journalEntry: { date: new Date('2026-09-01') } },
          { id: 'jl-2', debit: 120, credit: 0, journalEntry: { date: new Date('2026-09-02') } },
        ]),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);

    await service.importStatementLines('dealer-1', [{ date: '2026-09-01', description: 'Card payment', amount: 120 }]);

    expect(update).not.toHaveBeenCalled();
  });
});

describe('BankReconciliationService.matchManually', () => {
  it('throws when the bank line does not belong to this dealer', async () => {
    const prisma = { bankStatementLine: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);
    await expect(service.matchManually('dealer-1', 'missing', 'jl-1')).rejects.toThrow(NotFoundException);
  });

  it('refuses to match a journal line that is already matched to a different bank line', async () => {
    const prisma = {
      bankStatementLine: { findFirst: jest.fn().mockResolvedValue({ id: 'bank-line-1' }) },
      journalLine: { findFirst: jest.fn().mockResolvedValue({ id: 'jl-1', matchedByBankStatementLine: { id: 'other-bank-line' } }) },
    };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);
    await expect(service.matchManually('dealer-1', 'bank-line-1', 'jl-1')).rejects.toThrow(BadRequestException);
  });

  it('matches once both sides are validated', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'bank-line-1', status: BankLineStatus.MATCHED });
    const prisma = {
      bankStatementLine: { findFirst: jest.fn().mockResolvedValue({ id: 'bank-line-1' }), update },
      journalLine: { findFirst: jest.fn().mockResolvedValue({ id: 'jl-1', matchedByBankStatementLine: null }) },
    };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);
    await service.matchManually('dealer-1', 'bank-line-1', 'jl-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bank-line-1' },
      data: { status: BankLineStatus.MATCHED, matchedJournalLineId: 'jl-1' },
    });
  });
});

describe('BankReconciliationService.unmatch', () => {
  it('throws when the bank line does not belong to this dealer', async () => {
    const prisma = { bankStatementLine: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);
    await expect(service.unmatch('dealer-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('reverts a matched line back to unmatched', async () => {
    const update = jest.fn();
    const prisma = { bankStatementLine: { findFirst: jest.fn().mockResolvedValue({ id: 'bank-line-1' }), update } };
    const service = new BankReconciliationService(prisma as never, makeDocumentSequences() as never);
    await service.unmatch('dealer-1', 'bank-line-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bank-line-1' },
      data: { status: BankLineStatus.UNMATCHED, matchedJournalLineId: null },
    });
  });
});
