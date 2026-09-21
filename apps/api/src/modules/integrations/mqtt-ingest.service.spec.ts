import * as mqtt from 'mqtt';
import { IntegrationStatus, IntegrationType } from '@project-amx/shared';
import { MqttIngestService } from './mqtt-ingest.service';

jest.mock('mqtt', () => ({ connect: jest.fn() }));

function makeFakeClient() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    subscribe: jest.fn(),
    end: jest.fn(),
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
}

function makeConnector(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connector-1',
    dealerId: 'dealer-1',
    type: IntegrationType.MQTT,
    status: IntegrationStatus.ACTIVE,
    targetEntity: 'VEHICLE',
    matchField: 'vin',
    mappings: [],
    config: { brokerUrl: 'mqtt://broker.example.com', topic: 'oem/vehicles' },
    ...overrides,
  };
}

describe('MqttIngestService.reconcile', () => {
  beforeEach(() => {
    (mqtt.connect as jest.Mock).mockReset();
  });

  it('subscribes a newly active MQTT connector', async () => {
    const client = makeFakeClient();
    (mqtt.connect as jest.Mock).mockReturnValue(client);
    const prisma = { integrationConnector: { findMany: jest.fn().mockResolvedValue([makeConnector()]) } };
    const service = new MqttIngestService(prisma as never, { ingest: jest.fn() } as never);

    await service.reconcile();

    expect(mqtt.connect).toHaveBeenCalledWith('mqtt://broker.example.com', expect.objectContaining({ reconnectPeriod: 5000 }));
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledWith('oem/vehicles');
  });

  it('does not subscribe a connector missing brokerUrl/topic', async () => {
    const prisma = { integrationConnector: { findMany: jest.fn().mockResolvedValue([makeConnector({ config: {} })]) } };
    const service = new MqttIngestService(prisma as never, { ingest: jest.fn() } as never);

    await service.reconcile();

    expect(mqtt.connect).not.toHaveBeenCalled();
  });

  it('runs an inbound message through the ingest engine', async () => {
    const client = makeFakeClient();
    (mqtt.connect as jest.Mock).mockReturnValue(client);
    const ingestService = { ingest: jest.fn().mockResolvedValue({}) };
    const connector = makeConnector();
    const prisma = { integrationConnector: { findMany: jest.fn().mockResolvedValue([connector]) } };
    const service = new MqttIngestService(prisma as never, ingestService as never);

    await service.reconcile();
    client.emit('message', 'oem/vehicles', Buffer.from(JSON.stringify({ vin: 'ABC' })));
    await Promise.resolve();

    expect(ingestService.ingest).toHaveBeenCalledWith(expect.objectContaining({ id: 'connector-1' }), { vin: 'ABC' });
  });

  it('unsubscribes a connector that is no longer active', async () => {
    const client = makeFakeClient();
    (mqtt.connect as jest.Mock).mockReturnValue(client);
    const findMany = jest.fn();
    const prisma = { integrationConnector: { findMany } };
    const service = new MqttIngestService(prisma as never, { ingest: jest.fn() } as never);

    findMany.mockResolvedValueOnce([makeConnector()]);
    await service.reconcile();
    expect(mqtt.connect).toHaveBeenCalledTimes(1);

    findMany.mockResolvedValueOnce([]);
    await service.reconcile();

    expect(client.end).toHaveBeenCalledWith(true);
  });

  it('does not re-subscribe an already-subscribed connector with unchanged config', async () => {
    const client = makeFakeClient();
    (mqtt.connect as jest.Mock).mockReturnValue(client);
    const prisma = { integrationConnector: { findMany: jest.fn().mockResolvedValue([makeConnector()]) } };
    const service = new MqttIngestService(prisma as never, { ingest: jest.fn() } as never);

    await service.reconcile();
    await service.reconcile();

    expect(mqtt.connect).toHaveBeenCalledTimes(1);
  });
});
