import { ServicePlansService } from './service-plans.service';

const dealerId = 'dealer-1';

describe('ServicePlansService.runDueReminders', () => {
  it('sends due MOT reminders, stamps them, and counts what was sent', async () => {
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const sms = { send: jest.fn().mockResolvedValue(undefined) };
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
    const service = new ServicePlansService(prisma as never, email as never, sms as never);
    const result = await service.runDueReminders(dealerId);
    expect(result.motSent).toBe(1);
    expect(result.serviceSent).toBe(0);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(prisma.servicePlanSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' }, data: expect.objectContaining({ motReminderSentAt: expect.any(Date) }) }),
    );
  });

  it('sends nothing when no reminders are due', async () => {
    const email = { send: jest.fn() };
    const sms = { send: jest.fn() };
    const prisma = { servicePlanSubscription: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() } };
    const service = new ServicePlansService(prisma as never, email as never, sms as never);
    const result = await service.runDueReminders(dealerId);
    expect(result.total).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });
});
