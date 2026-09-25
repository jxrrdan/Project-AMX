import { VehicleValuationService } from './vehicle-valuation.service';

function makeService() {
  return new VehicleValuationService({ get: jest.fn().mockReturnValue('mock') } as never);
}

describe('VehicleValuationService.getValuation', () => {
  it('returns the same valuation for the same reg and mileage (deterministic)', async () => {
    const service = makeService();
    const first = await service.getValuation('AB12CDE', 40000);
    const second = await service.getValuation('AB12CDE', 40000);
    expect(first).toEqual(second);
  });

  it('reduces the valuation as mileage increases', async () => {
    const service = makeService();
    const low = await service.getValuation('AB12CDE', 10000);
    const high = await service.getValuation('AB12CDE', 100000);
    expect(high.privateRetailValue).toBeLessThan(low.privateRetailValue);
  });

  it('orders trade < part-exchange < private retail', async () => {
    const service = makeService();
    const result = await service.getValuation('AB12CDE', 40000);
    expect(result.tradeValue).toBeLessThanOrEqual(result.partExchangeValue);
    expect(result.partExchangeValue).toBeLessThanOrEqual(result.privateRetailValue);
  });
});
