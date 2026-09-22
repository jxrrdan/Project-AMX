import { BadRequestException } from '@nestjs/common';
import { NominalAccountType } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { CONTROL_ACCOUNT_CODES } from './ledger.constants';

function account(code: string, type: NominalAccountType, overrides: Record<string, unknown> = {}) {
  return { id: `acc-${code}`, dealerId: 'dealer-1', code, name: code, type, ...overrides };
}

describe('LedgerService.post', () => {
  it('rejects an unbalanced journal entry', async () => {
    const prisma = { nominalAccount: { count: jest.fn(), findMany: jest.fn() }, journalEntry: { create: jest.fn() } };
    const service = new LedgerService(prisma as never);
    await expect(
      service.post('dealer-1', {
        reference: 'REF-1',
        description: 'test',
        lines: [
          { accountCode: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, debit: 100 },
          { accountCode: CONTROL_ACCOUNT_CODES.VEHICLE_SALES, credit: 90 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a posting against an unknown account code', async () => {
    const prisma = {
      nominalAccount: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([account(CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, NominalAccountType.ASSET)]),
      },
      journalEntry: { create: jest.fn() },
    };
    const service = new LedgerService(prisma as never);
    await expect(
      service.post('dealer-1', {
        reference: 'REF-2',
        description: 'test',
        lines: [
          { accountCode: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, debit: 100 },
          { accountCode: 'NOT-A-CODE', credit: 100 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('seeds the default chart of accounts once, then posts a balanced entry', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'je-1' });
    const prisma = {
      nominalAccount: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          account(CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, NominalAccountType.ASSET),
          account(CONTROL_ACCOUNT_CODES.VEHICLE_SALES, NominalAccountType.INCOME),
        ]),
      },
      journalEntry: { create },
    };
    const service = new LedgerService(prisma as never);
    await service.post('dealer-1', {
      reference: 'REF-3',
      description: 'test',
      lines: [
        { accountCode: CONTROL_ACCOUNT_CODES.DEBTORS_CONTROL, debit: 100 },
        { accountCode: CONTROL_ACCOUNT_CODES.VEHICLE_SALES, credit: 100 },
      ],
    });
    expect(prisma.nominalAccount.createMany).toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });
});

describe('LedgerService.computeVatReturn', () => {
  it('computes VAT100 box values from journal lines in the period', async () => {
    const lines = [
      {
        debit: 0,
        credit: 100,
        vatAmount: 20,
        account: account(CONTROL_ACCOUNT_CODES.VAT_OUTPUT, NominalAccountType.LIABILITY),
      },
      {
        debit: 10,
        credit: 0,
        vatAmount: 10,
        account: account(CONTROL_ACCOUNT_CODES.VAT_INPUT, NominalAccountType.ASSET),
      },
      {
        debit: 0,
        credit: 500,
        vatAmount: null,
        account: account(CONTROL_ACCOUNT_CODES.VEHICLE_SALES, NominalAccountType.INCOME),
      },
      {
        debit: 200,
        credit: 0,
        vatAmount: null,
        account: account(CONTROL_ACCOUNT_CODES.PARTS_PURCHASES, NominalAccountType.EXPENSE),
      },
    ];
    const prisma = { journalLine: { findMany: jest.fn().mockResolvedValue(lines) } };
    const service = new LedgerService(prisma as never);
    const result = await service.computeVatReturn('dealer-1', '2026-01-01', '2026-01-31');
    expect(result.box1VatDueSales).toBe(20);
    expect(result.box4VatReclaimed).toBe(10);
    expect(result.box5NetVatDue).toBe(10);
    expect(result.box6TotalSalesExVat).toBe(500);
    expect(result.box7TotalPurchasesExVat).toBe(200);
  });
});
