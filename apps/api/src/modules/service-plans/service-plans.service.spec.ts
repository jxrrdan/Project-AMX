import { AccountTransactionType } from '@project-amx/shared';
import { ServicePlansService } from './service-plans.service';

const dealerId = 'dealer-1';

function makeService(prisma: unknown, accountCustomers: unknown = {}) {
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const sms = { send: jest.fn().mockResolvedValue(undefined) };
  return { service: new ServicePlansService(prisma as never, email as never, sms as never, accountCustomers as never), email, sms };
}

describe('ServicePlansService.runDueReminders', () => {
  it('sends due MOT reminders, stamps them, and counts what was sent', async () => {
    const prisma = {
      servicePlanSubscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-1',
            customerName: 'Sarah',
            vehicleReg: 'NN21ABC',
            contactEmail: 'sarah@example.com',
            contactPhone: null,
            motDueDate: new Date(),
            motReminderSentAt: null,
            serviceDueDate: null,
            serviceReminderSentAt: null,
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const { service, email } = makeService(prisma);
    const result = await service.runDueReminders(dealerId);
    expect(result.motSent).toBe(1);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(prisma.servicePlanSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' }, data: expect.objectContaining({ motReminderSentAt: expect.any(Date) }) }),
    );
  });

  it('sends nothing when no reminders are due', async () => {
    const prisma = { servicePlanSubscription: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() } };
    const { service, email } = makeService(prisma);
    const result = await service.runDueReminders(dealerId);
    expect(result.total).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('ServicePlansService.runBilling', () => {
  it('posts the monthly charge to AR and stamps lastBilledAt for account-linked subs', async () => {
    const prisma = {
      servicePlanSubscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sub-1', accountCustomerId: 'acc-1', vehicleReg: 'NN21ABC', plan: { name: '3-Year Plan', priceMonthly: 29.99 } },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const accountCustomers = { addTransaction: jest.fn().mockResolvedValue({}) };
    const { service } = makeService(prisma, accountCustomers);
    const result = await service.runBilling(dealerId);
    expect(result.billed).toBe(1);
    expect(result.total).toBe(29.99);
    expect(accountCustomers.addTransaction).toHaveBeenCalledWith(
      dealerId,
      'acc-1',
      expect.objectContaining({ type: AccountTransactionType.INVOICE, amount: 29.99 }),
    );
    expect(prisma.servicePlanSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' }, data: expect.objectContaining({ lastBilledAt: expect.any(Date) }) }),
    );
  });

  it('skips subscriptions whose plan is free', async () => {
    const prisma = {
      servicePlanSubscription: {
        findMany: jest.fn().mockResolvedValue([{ id: 'sub-2', accountCustomerId: 'acc-1', vehicleReg: 'X', plan: { name: 'Free', priceMonthly: 0 } }]),
        update: jest.fn(),
      },
    };
    const accountCustomers = { addTransaction: jest.fn() };
    const { service } = makeService(prisma, accountCustomers);
    const result = await service.runBilling(dealerId);
    expect(result.billed).toBe(0);
    expect(accountCustomers.addTransaction).not.toHaveBeenCalled();
  });
});
