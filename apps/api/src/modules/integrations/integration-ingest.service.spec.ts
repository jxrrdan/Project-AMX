import { IntegrationRunStatus, IntegrationStatus, IntegrationTargetEntity } from '@project-amx/shared';
import { IngestableConnector, IntegrationIngestService } from './integration-ingest.service';

function makeConnector(overrides: Partial<IngestableConnector> = {}): IngestableConnector {
  return {
    id: 'connector-1',
    dealerId: 'dealer-1',
    targetEntity: IntegrationTargetEntity.VEHICLE,
    matchField: 'vin',
    mappings: [
      { sourcePath: 'vin', targetField: 'vin', isCustomField: false, transform: null },
      { sourcePath: 'model', targetField: 'model', isCustomField: false, transform: null },
    ],
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    vehicle: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new-vehicle' }),
      update: jest.fn().mockResolvedValue({ id: 'existing-vehicle' }),
    },
    integrationConnector: { update: jest.fn().mockResolvedValue({}) },
    integrationRunLog: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

describe('IntegrationIngestService.ingest', () => {
  it('creates a new record, scoped to the connector\'s own dealer, when no match is found', async () => {
    const prisma = makePrisma();
    const service = new IntegrationIngestService(prisma as never);

    await service.ingest(makeConnector(), { vin: 'WBA123', model: 'BMW X1' });

    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: { vin: 'WBA123', model: 'BMW X1', dealerId: 'dealer-1', customFields: {} },
    });
  });

  it('only ever looks up an existing match within the connector\'s own dealer (cross-tenant safety)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vehicle: { findFirst, create: jest.fn().mockResolvedValue({}), update: jest.fn() } });
    const service = new IntegrationIngestService(prisma as never);

    await service.ingest(makeConnector({ dealerId: 'dealer-1' }), { vin: 'WBA123', model: 'BMW X1' });

    expect(findFirst).toHaveBeenCalledWith({ where: { dealerId: 'dealer-1', vin: 'WBA123' } });
  });

  it('updates the matched record and merges custom fields rather than clobbering existing ones', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-1', customFields: { existingKey: 'keepMe' } }),
        create: jest.fn(),
        update,
      },
    });
    const connector = makeConnector({
      mappings: [
        { sourcePath: 'vin', targetField: 'vin', isCustomField: false, transform: null },
        { sourcePath: 'oemCode', targetField: 'oemDealerNetCode', isCustomField: true, transform: null },
      ],
    });
    const service = new IntegrationIngestService(prisma as never);

    await service.ingest(connector, { vin: 'WBA123', oemCode: 'GB-045' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'existing-1' },
      data: { vin: 'WBA123', customFields: { existingKey: 'keepMe', oemDealerNetCode: 'GB-045' } },
    });
  });

  it('silently drops a mapping whose targetField is not in the allowlist (defence in depth)', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() } });
    const connector = makeConnector({
      matchField: null,
      mappings: [{ sourcePath: 'x', targetField: 'dealerId', isCustomField: false, transform: null }],
    });
    const service = new IntegrationIngestService(prisma as never);

    await service.ingest(connector, { x: 'attacker-controlled-dealer-id' });

    expect(create).toHaveBeenCalledWith({ data: { dealerId: 'dealer-1', customFields: {} } });
  });

  it('processes every record in an array payload', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() } });
    const service = new IntegrationIngestService(prisma as never);

    const result = await service.ingest(makeConnector({ matchField: null }), [
      { vin: 'A', model: '1' },
      { vin: 'B', model: '2' },
    ]);

    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ recordsIn: 2, recordsMapped: 2 });
  });

  it('records a SUCCESS run log and clears any prior error on a clean run', async () => {
    const prisma = makePrisma();
    const service = new IntegrationIngestService(prisma as never);

    await service.ingest(makeConnector(), { vin: 'WBA123', model: 'X1' });

    expect(prisma.integrationRunLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: IntegrationRunStatus.SUCCESS }) }),
    );
    expect(prisma.integrationConnector.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastError: null, status: undefined }) }),
    );
  });

  it('records an ERROR run log, marks the connector ERROR, and rethrows when the write fails', async () => {
    const prisma = makePrisma({
      vehicle: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new Error('constraint violation')),
        update: jest.fn(),
      },
    });
    const service = new IntegrationIngestService(prisma as never);

    await expect(service.ingest(makeConnector(), { vin: 'WBA123', model: 'X1' })).rejects.toThrow('constraint violation');

    expect(prisma.integrationRunLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: IntegrationRunStatus.ERROR }) }),
    );
    expect(prisma.integrationConnector.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: IntegrationStatus.ERROR }) }),
    );
  });
});
