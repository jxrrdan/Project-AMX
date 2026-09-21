import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IntegrationTargetEntity, IntegrationType } from '@project-amx/shared';
import { IntegrationsService } from './integrations.service';

function makeIngestService() {
  return { ingest: jest.fn().mockResolvedValue({ recordsIn: 1, recordsMapped: 1 }) };
}

describe('IntegrationsService connector CRUD — tenant scoping', () => {
  const dealerId = 'dealer-1';

  it('updateConnector refuses to update another dealer\'s connector', async () => {
    const update = jest.fn();
    const prisma = { integrationConnector: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);
    await expect(service.updateConnector(dealerId, 'other-dealer-connector', { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('deleteConnector refuses to delete another dealer\'s connector', async () => {
    const del = jest.fn();
    const prisma = { integrationConnector: { findFirst: jest.fn().mockResolvedValue(null), delete: del } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);
    await expect(service.deleteConnector(dealerId, 'other-dealer-connector')).rejects.toThrow(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it('regenerateWebhookToken refuses another dealer\'s connector', async () => {
    const update = jest.fn();
    const prisma = { integrationConnector: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);
    await expect(service.regenerateWebhookToken(dealerId, 'other-dealer-connector')).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('IntegrationsService.createConnector — model-enrichment SSRF validation', () => {
  const dealerId = 'dealer-1';

  it('rejects an unsafe modelEnrichment.metadataUrlTemplate even on a non-REST_PULL connector (e.g. MQTT)', () => {
    const create = jest.fn();
    const prisma = { integrationConnector: { create } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    expect(() =>
      service.createConnector(dealerId, {
        name: 'MQTT feed',
        type: IntegrationType.MQTT,
        targetEntity: IntegrationTargetEntity.VEHICLE,
        config: { brokerUrl: 'mqtt://broker.example.com', topic: 'x', modelEnrichment: { metadataUrlTemplate: 'http://169.254.169.254/{model}' } },
      } as never),
    ).toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts a safe modelEnrichment.metadataUrlTemplate', () => {
    const create = jest.fn().mockReturnValue({ id: 'c1' });
    const prisma = { integrationConnector: { create } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    service.createConnector(dealerId, {
      name: 'MQTT feed',
      type: IntegrationType.MQTT,
      targetEntity: IntegrationTargetEntity.VEHICLE,
      config: { brokerUrl: 'mqtt://broker.example.com', topic: 'x', modelEnrichment: { metadataUrlTemplate: 'https://oem.example.com/models/{model}' } },
    } as never);

    expect(create).toHaveBeenCalled();
  });
});

describe('IntegrationsService.setMappings', () => {
  const dealerId = 'dealer-1';
  const connectorId = 'connector-1';

  it('rejects a mapping targeting a column outside the allowlist for the entity', async () => {
    const prisma = {
      integrationConnector: {
        findFirst: jest.fn().mockResolvedValue({ id: connectorId, targetEntity: IntegrationTargetEntity.VEHICLE }),
      },
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(
      service.setMappings(dealerId, connectorId, [{ sourcePath: 'x', targetField: 'dealerId' } as never]),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a custom-field mapping whose key has not been defined for this dealer/entity', async () => {
    const prisma = {
      integrationConnector: {
        findFirst: jest.fn().mockResolvedValue({ id: connectorId, targetEntity: IntegrationTargetEntity.VEHICLE }),
      },
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(
      service.setMappings(dealerId, connectorId, [
        { sourcePath: 'x', targetField: 'undefinedCustomField', isCustomField: true } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a valid column mapping and a valid, already-defined custom field mapping', async () => {
    const transactionResult = [{ id: 'm1' }];
    const prisma = {
      integrationConnector: {
        findFirst: jest.fn().mockResolvedValue({ id: connectorId, targetEntity: IntegrationTargetEntity.VEHICLE }),
      },
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([{ key: 'oemDealerNetCode' }]) },
      $transaction: jest.fn().mockImplementation(async (fn) =>
        fn({
          integrationFieldMapping: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
            findMany: jest.fn().mockResolvedValue(transactionResult),
          },
        }),
      ),
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    const result = await service.setMappings(dealerId, connectorId, [
      { sourcePath: 'vin', targetField: 'vin' } as never,
      { sourcePath: 'code', targetField: 'oemDealerNetCode', isCustomField: true } as never,
    ]);

    expect(result).toEqual(transactionResult);
  });
});

describe('IntegrationsService.createCustomField', () => {
  const dealerId = 'dealer-1';

  it('rejects a duplicate key for the same dealer/entity', async () => {
    const create = jest.fn();
    const prisma = {
      customFieldDefinition: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }), create },
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(
      service.createCustomField(dealerId, { entity: IntegrationTargetEntity.VEHICLE, key: 'oemCode', label: 'OEM Code' }),
    ).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('IntegrationsService webhook/test-payload', () => {
  it('rejects an unknown webhook token', async () => {
    const ingestService = makeIngestService();
    const prisma = { integrationConnector: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new IntegrationsService(prisma as never, ingestService as never);

    await expect(service.handleWebhook('unknown-token', {}, {})).rejects.toThrow(NotFoundException);
    expect(ingestService.ingest).not.toHaveBeenCalled();
  });

  it('runs a valid webhook payload through the ingest engine', async () => {
    const ingestService = makeIngestService();
    const connector = { id: 'connector-1', dealerId: 'dealer-1', mappings: [], config: {} };
    const prisma = { integrationConnector: { findUnique: jest.fn().mockResolvedValue(connector) } };
    const service = new IntegrationsService(prisma as never, ingestService as never);

    await service.handleWebhook('real-token', { vin: 'ABC' }, {});
    expect(ingestService.ingest).toHaveBeenCalledWith(connector, { vin: 'ABC' });
  });

  it('rejects a webhook missing the configured shared-secret header', async () => {
    const ingestService = makeIngestService();
    const connector = {
      id: 'connector-1',
      dealerId: 'dealer-1',
      mappings: [],
      config: { requiredHeaderName: 'X-Shared-Secret', requiredHeaderValue: 'sekret' },
    };
    const prisma = { integrationConnector: { findUnique: jest.fn().mockResolvedValue(connector) } };
    const service = new IntegrationsService(prisma as never, ingestService as never);

    await expect(service.handleWebhook('real-token', { vin: 'ABC' }, {})).rejects.toThrow(ForbiddenException);
    expect(ingestService.ingest).not.toHaveBeenCalled();
  });

  it('accepts a webhook whose shared-secret header matches (case-insensitive header name)', async () => {
    const ingestService = makeIngestService();
    const connector = {
      id: 'connector-1',
      dealerId: 'dealer-1',
      mappings: [],
      config: { requiredHeaderName: 'X-Shared-Secret', requiredHeaderValue: 'sekret' },
    };
    const prisma = { integrationConnector: { findUnique: jest.fn().mockResolvedValue(connector) } };
    const service = new IntegrationsService(prisma as never, ingestService as never);

    await service.handleWebhook('real-token', { vin: 'ABC' }, { 'x-shared-secret': 'sekret' });
    expect(ingestService.ingest).toHaveBeenCalled();
  });

  it('testPayload refuses another dealer\'s connector', async () => {
    const ingestService = makeIngestService();
    const prisma = { integrationConnector: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new IntegrationsService(prisma as never, ingestService as never);

    await expect(service.testPayload('dealer-1', 'other-dealer-connector', {})).rejects.toThrow(NotFoundException);
    expect(ingestService.ingest).not.toHaveBeenCalled();
  });
});

describe('IntegrationsService UI screens', () => {
  const dealerId = 'dealer-1';
  const entity = IntegrationTargetEntity.VEHICLE;

  it('getScreen returns an empty field list when no screen has been saved yet', async () => {
    const prisma = { uiScreenDefinition: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    const result = await service.getScreen(dealerId, entity);
    expect(result).toEqual({ entity, fields: [] });
  });

  it('getScreen returns the saved fields, scoped to this dealer and entity', async () => {
    const savedFields = [{ field: 'vin', label: 'VIN' }];
    const findUnique = jest.fn().mockResolvedValue({ fields: savedFields });
    const prisma = { uiScreenDefinition: { findUnique } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    const result = await service.getScreen(dealerId, entity);
    expect(result).toEqual({ entity, fields: savedFields });
    expect(findUnique).toHaveBeenCalledWith({ where: { dealerId_entity: { dealerId, entity } } });
  });

  it('saveScreen rejects a field outside the allowlist for the entity', async () => {
    const upsert = jest.fn();
    const prisma = {
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      uiScreenDefinition: { upsert },
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(
      service.saveScreen(dealerId, entity, [{ field: 'dealerId', label: 'Dealer' } as never]),
    ).rejects.toThrow(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saveScreen rejects a custom field that has not been defined for this dealer/entity', async () => {
    const upsert = jest.fn();
    const prisma = {
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      uiScreenDefinition: { upsert },
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(
      service.saveScreen(dealerId, entity, [{ field: 'undefinedField', label: 'X', isCustomField: true } as never]),
    ).rejects.toThrow(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saveScreen accepts a valid mix of standard and custom fields and upserts scoped to dealer+entity', async () => {
    const fields = [
      { field: 'vin', label: 'VIN' },
      { field: 'oemDealerNetCode', label: 'OEM Code', isCustomField: true },
    ];
    const upsert = jest.fn().mockResolvedValue({ entity, fields });
    const prisma = {
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([{ key: 'oemDealerNetCode' }]) },
      uiScreenDefinition: { upsert },
    };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    const result = await service.saveScreen(dealerId, entity, fields as never);
    expect(result).toEqual({ entity, fields });
    expect(upsert).toHaveBeenCalledWith({
      where: { dealerId_entity: { dealerId, entity } },
      update: { fields },
      create: { dealerId, entity, fields },
    });
  });

  it('getRecord throws when the record does not exist for this dealer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { vehicle: { findFirst } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(service.getRecord(dealerId, entity, 'veh-1')).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'veh-1', dealerId } });
  });

  it('getRecord returns the record when it belongs to this dealer', async () => {
    const record = { id: 'veh-1', dealerId, vin: 'ABC' };
    const prisma = { vehicle: { findFirst: jest.fn().mockResolvedValue(record) } };
    const service = new IntegrationsService(prisma as never, makeIngestService() as never);

    await expect(service.getRecord(dealerId, entity, 'veh-1')).resolves.toEqual(record);
  });
});
