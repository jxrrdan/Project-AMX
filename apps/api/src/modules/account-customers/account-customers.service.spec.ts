import { NotFoundException } from '@nestjs/common';
import { AccountTransactionType } from '@project-amx/shared';
import { AccountCustomersService } from './account-customers.service';

const dealerId = 'dealer-1';

function makeTxMock() {
  return {
    accountTransaction: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'txn-1', ...data })) },
    accountCustomer: { update: jest.fn().mockResolvedValue({}) },
  };
}

describe('AccountCustomersService', () => {
  it('throws when the account is not owned by the dealer', async () => {
    const prisma = { accountCustomer: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AccountCustomersService(prisma as never);
    await expect(service.update(dealerId, 'acc-1', { name: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('an INVOICE transaction increases the balance by +amount', async () => {
    const tx = makeTxMock();
    const prisma = {
      accountCustomer: { findFirst: jest.fn().mockResolvedValue({ id: 'acc-1', dealerId }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new AccountCustomersService(prisma as never);
    await service.addTransaction(dealerId, 'acc-1', { type: AccountTransactionType.INVOICE, description: 'Job', amount: 100 });
    const updateArg = tx.accountCustomer.update.mock.calls[0][0];
    expect(Number(updateArg.data.balance.increment)).toBe(100);
  });

  it('a PAYMENT transaction decreases the balance by amount', async () => {
    const tx = makeTxMock();
    const prisma = {
      accountCustomer: { findFirst: jest.fn().mockResolvedValue({ id: 'acc-1', dealerId }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new AccountCustomersService(prisma as never);
    await service.addTransaction(dealerId, 'acc-1', { type: AccountTransactionType.PAYMENT, description: 'Paid', amount: 40 });
    const updateArg = tx.accountCustomer.update.mock.calls[0][0];
    expect(Number(updateArg.data.balance.increment)).toBe(-40);
  });

  it('builds a statement with opening balance, running balances and closing balance', async () => {
    const prisma = {
      accountCustomer: { findFirst: jest.fn().mockResolvedValue({ id: 'acc-1', dealerId, name: 'Fleet Ltd', creditLimit: 5000, balance: 60 }) },
      accountTransaction: {
        findMany: jest
          .fn()
          // prior transactions (before the period): one £100 invoice
          .mockResolvedValueOnce([{ type: 'INVOICE', amount: 100 }])
          // period transactions: a £40 payment
          .mockResolvedValueOnce([
            { id: 't1', type: 'PAYMENT', description: 'Payment', reference: null, occurredAt: new Date(), amount: 40 },
          ]),
      },
    };
    const service = new AccountCustomersService(prisma as never);
    const statement = await service.statement(dealerId, 'acc-1');
    expect(statement.openingBalance).toBe(100);
    expect(statement.lines[0].signedAmount).toBe(-40);
    expect(statement.lines[0].runningBalance).toBe(60);
    expect(statement.closingBalance).toBe(60);
  });
});
