import axios from 'axios';
import { IntegrationStatus } from '@project-amx/shared';
import { RestPollerService } from './rest-poller.service';

jest.mock('axios');

function makeConnector(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connector-1',
    dealerId: 'dealer-1',
    targetEntity: 'VEHICLE',
    matchField: 'vin',
    mappings: [],
    lastRunAt: null,
    config: { url: 'https://oem.example.com/vehicles', pollIntervalMinutes: 15 },
    ...overrides,
  };
}

describe('RestPollerService.pollDueConnectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('polls a connector that has never run before', async () => {
    (axios.request as jest.Mock).mockResolvedValue({ data: [{ vin: 'A' }] });
    const ingestService = { ingest: jest.fn().mockResolvedValue({}) };
    const prisma = {
      integrationConnector: {
        findMany: jest.fn().mockResolvedValue([makeConnector()]),
        update: jest.fn(),
      },
      integrationRunLog: { create: jest.fn() },
    };
    const service = new RestPollerService(prisma as never, ingestService as never);

    await service.pollDueConnectors();

    expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://oem.example.com/vehicles' }));
    expect(ingestService.ingest).toHaveBeenCalled();
  });

  it('skips a connector whose poll interval has not elapsed yet', async () => {
    const ingestService = { ingest: jest.fn() };
    const prisma = {
      integrationConnector: {
        findMany: jest.fn().mockResolvedValue([makeConnector({ lastRunAt: new Date() })]),
        update: jest.fn(),
      },
      integrationRunLog: { create: jest.fn() },
    };
    const service = new RestPollerService(prisma as never, ingestService as never);

    await service.pollDueConnectors();

    expect(axios.request).not.toHaveBeenCalled();
    expect(ingestService.ingest).not.toHaveBeenCalled();
  });

  it('polls a connector whose interval has elapsed since its last run', async () => {
    (axios.request as jest.Mock).mockResolvedValue({ data: [] });
    const ingestService = { ingest: jest.fn().mockResolvedValue({}) };
    const staleRun = new Date(Date.now() - 20 * 60_000);
    const prisma = {
      integrationConnector: {
        findMany: jest.fn().mockResolvedValue([makeConnector({ lastRunAt: staleRun })]),
        update: jest.fn(),
      },
      integrationRunLog: { create: jest.fn() },
    };
    const service = new RestPollerService(prisma as never, ingestService as never);

    await service.pollDueConnectors();

    expect(axios.request).toHaveBeenCalled();
  });

  it('extracts records via resultsPath when the array is nested in the response', async () => {
    (axios.request as jest.Mock).mockResolvedValue({ data: { result: { vehicles: [{ vin: 'A' }, { vin: 'B' }] } } });
    const ingestService = { ingest: jest.fn().mockResolvedValue({}) };
    const prisma = {
      integrationConnector: {
        findMany: jest.fn().mockResolvedValue([
          makeConnector({ config: { url: 'https://x', resultsPath: 'result.vehicles', pollIntervalMinutes: 15 } }),
        ]),
        update: jest.fn(),
      },
      integrationRunLog: { create: jest.fn() },
    };
    const service = new RestPollerService(prisma as never, ingestService as never);

    await service.pollDueConnectors();

    expect(ingestService.ingest).toHaveBeenCalledWith(expect.anything(), [{ vin: 'A' }, { vin: 'B' }]);
  });

  it('records a failed poll (network/HTTP error) without throwing, and flags the connector ERROR', async () => {
    (axios.request as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
    const ingestService = { ingest: jest.fn() };
    const update = jest.fn();
    const runLogCreate = jest.fn();
    const prisma = {
      integrationConnector: { findMany: jest.fn().mockResolvedValue([makeConnector()]), update },
      integrationRunLog: { create: runLogCreate },
    };
    const service = new RestPollerService(prisma as never, ingestService as never);

    await expect(service.pollDueConnectors()).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: IntegrationStatus.ERROR, lastError: 'ECONNREFUSED' }) }),
    );
    expect(runLogCreate).toHaveBeenCalled();
  });

  it('does not poll a connector with no url configured', async () => {
    const ingestService = { ingest: jest.fn() };
    const prisma = {
      integrationConnector: {
        findMany: jest.fn().mockResolvedValue([makeConnector({ config: {} })]),
        update: jest.fn(),
      },
      integrationRunLog: { create: jest.fn() },
    };
    const service = new RestPollerService(prisma as never, ingestService as never);

    await service.pollDueConnectors();

    expect(axios.request).not.toHaveBeenCalled();
  });
});
