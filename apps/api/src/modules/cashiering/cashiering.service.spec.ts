import { PaymentKind, PaymentMethod } from '@project-amx/shared';
import { CashieringService } from './cashiering.service';

const dealerId = 'dealer-1';

describe('CashieringService', () => {
  it('reconciliation nets refunds against takings and totals by method', async () => {
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([
          { method: 'CARD', kind: 'PAYMENT', amount: 100 },
          { method: 'CASH', kind: 'PAYMENT', amount: 50 },
          { method: 'CARD', kind: 'REFUND', amount: 30 },
        ]),
      },
    };
    const service = new CashieringService(prisma as never, {} as never);
    const recon = await service.reconciliation(dealerId, '2026-09-29');
    expect(recon.net).toBe(120); // 100 + 50 - 30
    expect(recon.byMethod['CARD']).toBe(70); // 100 - 30
    expect(recon.byMethod['CASH']).toBe(50);
    expect(recon.count).toBe(3);
  });

  it('posts to the account ledger when a payment is linked to an account customer', async () => {
    const prisma = { payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) } };
    const accountCustomers = {
      findOne: jest.fn().mockResolvedValue({ id: 'acc-1' }),
      postCashDeskPayment: jest.fn().mockResolvedValue({}),
    };
    const service = new CashieringService(prisma as never, accountCustomers as never);
    await service.create(
      dealerId,
      { method: PaymentMethod.CARD, amount: 250, customerName: 'Acme', accountCustomerId: 'acc-1' },
      'Jo Bloggs',
    );
    expect(accountCustomers.findOne).toHaveBeenCalledWith(dealerId, 'acc-1');
    expect(accountCustomers.postCashDeskPayment).toHaveBeenCalledWith('acc-1', PaymentKind.PAYMENT, 250, undefined);
  });

  it('does not touch the ledger for a non-account payment', async () => {
    const prisma = { payment: { create: jest.fn().mockResolvedValue({ id: 'pay-2' }) } };
    const accountCustomers = { findOne: jest.fn(), postCashDeskPayment: jest.fn() };
    const service = new CashieringService(prisma as never, accountCustomers as never);
    await service.create(dealerId, { method: PaymentMethod.CASH, amount: 20, customerName: 'Walk-in' }, 'Jo Bloggs');
    expect(accountCustomers.postCashDeskPayment).not.toHaveBeenCalled();
  });
});
