import { AiInsightsService } from './ai-insights.service';

describe('AiInsightsService.serviceNoShowRisk', () => {
  const dealerId = 'dealer-1';

  it('scores a thin, unconfirmed, far-out booking as high risk', async () => {
    const prisma = {
      jobCard: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'jc-1',
            contact: { phone: null },
            serviceAdvisorId: null,
            scheduledStart: new Date(Date.now() + 20 * 86400000),
            vehicleReg: null,
            vehicleId: null,
          },
        ]),
      },
    };
    const service = new AiInsightsService({} as never, prisma as never, {} as never, {} as never);
    const result = await service.serviceNoShowRisk(dealerId);
    expect(result[0].riskScore).toBe(100);
    expect(result[0].reasons).toEqual(
      expect.arrayContaining([
        'no phone number on file to send a reminder',
        'no service advisor assigned to confirm it',
        'booked 20 days in advance',
        'no vehicle registration captured',
      ]),
    );
  });

  it('scores a fully-confirmed, near-term booking as low risk', async () => {
    const prisma = {
      jobCard: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'jc-2',
            contact: { phone: '+447700900000' },
            serviceAdvisorId: 'user-1',
            scheduledStart: new Date(Date.now() + 2 * 86400000),
            vehicleReg: 'AB12CDE',
            vehicleId: 'vehicle-1',
          },
        ]),
      },
    };
    const service = new AiInsightsService({} as never, prisma as never, {} as never, {} as never);
    const result = await service.serviceNoShowRisk(dealerId);
    expect(result[0].riskScore).toBe(15);
    expect(result[0].reasons).toEqual([]);
  });

  it('sorts descending by risk score', async () => {
    const prisma = {
      jobCard: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'low', contact: { phone: '+447700900000' }, serviceAdvisorId: 'user-1', scheduledStart: new Date(), vehicleReg: 'AB12CDE', vehicleId: 'v1' },
          { id: 'high', contact: { phone: null }, serviceAdvisorId: null, scheduledStart: new Date(), vehicleReg: null, vehicleId: null },
        ]),
      },
    };
    const service = new AiInsightsService({} as never, prisma as never, {} as never, {} as never);
    const result = await service.serviceNoShowRisk(dealerId);
    expect(result.map((r) => r.id)).toEqual(['high', 'low']);
  });
});

describe('AiInsightsService.usedCarPricingSuggestions', () => {
  const dealerId = 'dealer-1';

  it('recommends a reduction once a stale vehicle is priced above the mocked market valuation', async () => {
    const prisma = {
      usedVehicle: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'v1', reg: 'AB12CDE', mileage: 40000, askingPrice: 20000, createdAt: new Date(Date.now() - 70 * 86400000) },
        ]),
      },
    };
    const valuation = { getValuation: jest.fn().mockResolvedValue({ tradeValue: 12000, partExchangeValue: 13600, privateRetailValue: 16000 }) };
    const service = new AiInsightsService({} as never, prisma as never, {} as never, valuation as never);

    const result = await service.usedCarPricingSuggestions(dealerId);

    expect(result).toHaveLength(1);
    expect(result[0].recommendation).toContain('in stock 70 days');
  });

  it('omits a vehicle that is fairly priced against the valuation', async () => {
    const prisma = {
      usedVehicle: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'v1', reg: 'AB12CDE', mileage: 40000, askingPrice: 15500, createdAt: new Date() },
        ]),
      },
    };
    const valuation = { getValuation: jest.fn().mockResolvedValue({ tradeValue: 12000, partExchangeValue: 13600, privateRetailValue: 16000 }) };
    const service = new AiInsightsService({} as never, prisma as never, {} as never, valuation as never);

    const result = await service.usedCarPricingSuggestions(dealerId);

    expect(result).toHaveLength(0);
  });

  it('flags a vehicle more than 5% above market value even when freshly stocked', async () => {
    const prisma = {
      usedVehicle: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'v1', reg: 'AB12CDE', mileage: 40000, askingPrice: 18000, createdAt: new Date() },
        ]),
      },
    };
    const valuation = { getValuation: jest.fn().mockResolvedValue({ tradeValue: 12000, partExchangeValue: 13600, privateRetailValue: 16000 }) };
    const service = new AiInsightsService({} as never, prisma as never, {} as never, valuation as never);

    const result = await service.usedCarPricingSuggestions(dealerId);

    expect(result).toHaveLength(1);
    expect(result[0].recommendation).toContain('above suggested market value');
  });
});
