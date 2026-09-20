import { IntegrationRunStatus, IntegrationStatus, IntegrationTargetEntity } from '@project-amx/shared';
import { TenancyScopeService } from '../../common/tenancy/tenancy-scope.service';
import { IngestableConnector, IntegrationIngestService } from './integration-ingest.service';

jest.mock('axios');

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
    dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: null, franchise: null }) },
    ...overrides,
  };
}

function makeService(prisma: Record<string, unknown>) {
  return new IntegrationIngestService(prisma as never, new TenancyScopeService(prisma as never));
}

describe('IntegrationIngestService.ingest', () => {
  it('creates a new record, scoped to the connector\'s own dealer, when no match is found', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.ingest(makeConnector(), { vin: 'WBA123', model: 'BMW X1' });

    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: { vin: 'WBA123', model: 'BMW X1', dealerId: 'dealer-1', customFields: {} },
    });
  });

  it('only ever looks up an existing match within the connector\'s own dealer (cross-tenant safety)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vehicle: { findFirst, create: jest.fn().mockResolvedValue({}), update: jest.fn() } });
    const service = makeService(prisma);

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
    const service = makeService(prisma);

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
    const service = makeService(prisma);

    await service.ingest(connector, { x: 'attacker-controlled-dealer-id' });

    expect(create).toHaveBeenCalledWith({ data: { dealerId: 'dealer-1', customFields: {} } });
  });

  it('processes every record in an array payload', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() } });
    const service = makeService(prisma);

    const result = await service.ingest(makeConnector({ matchField: null }), [
      { vin: 'A', model: '1' },
      { vin: 'B', model: '2' },
    ]);

    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ recordsIn: 2, recordsMapped: 2 });
  });

  it('records a SUCCESS run log and clears any prior error on a clean run', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

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
    const service = makeService(prisma);

    await expect(service.ingest(makeConnector(), { vin: 'WBA123', model: 'X1' })).rejects.toThrow('constraint violation');

    expect(prisma.integrationRunLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: IntegrationRunStatus.ERROR }) }),
    );
    expect(prisma.integrationConnector.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: IntegrationStatus.ERROR }) }),
    );
  });
});

describe('IntegrationIngestService — model metadata enrichment', () => {
  const mockedAxios = jest.requireMock('axios') as { request: jest.Mock };

  beforeEach(() => {
    jest.resetModules();
  });

  it('does nothing when the connector has no modelEnrichment configured', async () => {
    const create = jest.fn().mockResolvedValue({});
    const vehicleModelMetadata = { findFirst: jest.fn(), create: jest.fn() };
    const prisma = makePrisma({
      vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
      vehicleModelMetadata,
    });
    const service = makeService(prisma);

    await service.ingest(makeConnector({ config: {} }), { vin: 'WBA123', model: 'MINI Aceman' });

    expect(vehicleModelMetadata.findFirst).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({ data: { vin: 'WBA123', model: 'MINI Aceman', dealerId: 'dealer-1', customFields: {} } });
  });

  it('reuses cached metadata for a known model without calling the metadata API', async () => {
    const create = jest.fn().mockResolvedValue({});
    const findFirst = jest.fn().mockResolvedValue({ data: { bodyType: 'Hatchback' } });
    const prisma = makePrisma({
      vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
      vehicleModelMetadata: { findFirst, create: jest.fn() },
    });
    const connector = makeConnector({ config: { modelEnrichment: { metadataUrlTemplate: 'https://oem.example.com/models/{model}' } } });
    const service = makeService(prisma);

    await service.ingest(connector, { vin: 'WBA123', model: 'MINI Aceman' });

    expect(findFirst).toHaveBeenCalledWith({ where: { scope: 'DEALER', dealerId: 'dealer-1', modelKey: 'mini aceman' } });
    expect(create).toHaveBeenCalledWith({
      data: { vin: 'WBA123', model: 'MINI Aceman', dealerId: 'dealer-1', customFields: { modelMetadata: { bodyType: 'Hatchback' } } },
    });
  });

  it('calls the configured metadata API and caches the result for an unknown model', async () => {
    const create = jest.fn().mockResolvedValue({});
    const metadataCreate = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
      vehicleModelMetadata: { findFirst: jest.fn().mockResolvedValue(null), create: metadataCreate },
    });
    mockedAxios.request.mockResolvedValue({ data: { bodyType: 'Hatchback', doors: 5 } });
    const connector = makeConnector({ config: { modelEnrichment: { metadataUrlTemplate: 'https://oem.example.com/models/{model}' } } });
    const service = makeService(prisma);

    await service.ingest(connector, { vin: 'WBA123', model: 'MINI Aceman' });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://oem.example.com/models/mini%20aceman' }));
    expect(metadataCreate).toHaveBeenCalledWith({
      data: { scope: 'DEALER', dealerId: 'dealer-1', franchiseId: undefined, modelKey: 'mini aceman', data: { bodyType: 'Hatchback', doors: 5 } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        vin: 'WBA123',
        model: 'MINI Aceman',
        dealerId: 'dealer-1',
        customFields: { modelMetadata: { bodyType: 'Hatchback', doors: 5 } },
      },
    });
  });

  it('degrades gracefully (never throws) when the metadata API is unreachable', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      vehicle: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
      vehicleModelMetadata: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    });
    mockedAxios.request.mockRejectedValue(new Error('ECONNREFUSED'));
    const connector = makeConnector({ config: { modelEnrichment: { metadataUrlTemplate: 'https://oem.example.com/models/{model}' } } });
    const service = makeService(prisma);

    const result = await service.ingest(connector, { vin: 'WBA123', model: 'MINI Aceman' });

    expect(result).toEqual({ recordsIn: 1, recordsMapped: 1 });
    expect(create).toHaveBeenCalledWith({ data: { vin: 'WBA123', model: 'MINI Aceman', dealerId: 'dealer-1', customFields: {} } });
  });
});
