import { ParcService } from './parc.service';

const dealerId = 'dealer-1';

describe('ParcService', () => {
  it('normalises the registration (uppercase, no spaces) when adding an entry', async () => {
    const prisma = { serviceHistoryEntry: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) } };
    const service = new ParcService(prisma as never);
    await service.addEntry(dealerId, { vehicleReg: 'nn21 abc', entryType: 'SERVICE', description: 'Oil', performedAt: '2026-03-01' });
    expect(prisma.serviceHistoryEntry.create.mock.calls[0][0].data.vehicleReg).toBe('NN21ABC');
  });

  it('looks up by normalised registration and aggregates history, used stock and recalls', async () => {
    const prisma = {
      serviceHistoryEntry: { findMany: jest.fn().mockResolvedValue([{ id: 'e1' }]) },
      usedVehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'uv1' }) },
      recallVehicle: { findMany: jest.fn().mockResolvedValue([{ id: 'rv1' }]) },
    };
    const service = new ParcService(prisma as never);
    const result = await service.lookup(dealerId, 'nn21 abc');
    expect(result.vehicleReg).toBe('NN21ABC');
    expect(prisma.serviceHistoryEntry.findMany).toHaveBeenCalledWith({
      where: { dealerId, vehicleReg: 'NN21ABC' },
      orderBy: { performedAt: 'desc' },
    });
    expect(result.entries).toHaveLength(1);
    expect(result.usedVehicle).toEqual({ id: 'uv1' });
    expect(result.recalls).toHaveLength(1);
  });
});
