import { ReportingService } from './reporting.service';

const dealerId = 'dealer-1';

describe('ReportingService.doc', () => {
  it('composes a Daily Operating Control snapshot from live aggregates', async () => {
    const prisma = {
      vehicle: { count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.status === 'DELIVERED' ? 2 : 10)) },
      usedVehicle: { count: jest.fn().mockResolvedValue(3) },
      jobCard: { count: jest.fn().mockResolvedValue(4) },
      part: { findMany: jest.fn().mockResolvedValue([{ quantityOnHand: 2, costPrice: 10 }, { quantityOnHand: 1, costPrice: 5 }]) },
      partBackorder: { count: jest.fn().mockResolvedValue(1) },
      payment: { findMany: jest.fn().mockResolvedValue([{ amount: 100, kind: 'PAYMENT' }, { amount: 30, kind: 'REFUND' }]) },
      accountCustomer: { aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 1440 } }) },
      creditNote: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: 132 }, _count: 2 }) },
      recallVehicle: { count: jest.fn().mockResolvedValue(0) },
      servicePlanSubscription: { count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.motDueDate ? 1 : 2)) },
    };
    const service = new ReportingService(prisma as never);
    const doc = await service.doc(dealerId);

    expect(doc.sales).toEqual({ pipeline: 10, delivered: 2, inProgress: 8, usedStock: 3 });
    expect(doc.aftersales).toEqual({ openJobCards: 4, recallsOutstanding: 0, motRemindersDue: 1, serviceRemindersDue: 2 });
    expect(doc.parts).toEqual({ stockValue: 25, backordersOutstanding: 1 });
    expect(doc.finance).toEqual({ cashTakenToday: 70, agedDebtorsTotal: 1440, creditNotesIssued: 2, creditNotesIssuedValue: 132 });
  });
});
