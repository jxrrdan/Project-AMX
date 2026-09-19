import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomFieldDataType, IntegrationTargetEntity } from '@project-amx/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateConnectorDto,
  CreateCustomFieldDto,
  FieldMappingDto,
  ScreenFieldDto,
  UpdateConnectorDto,
} from './dto/integration.dto';
import { ENTITY_MODEL_NAME, isKnownTargetField, TARGET_ENTITY_FIELDS } from './field-mapping.util';
import { IntegrationIngestService } from './integration-ingest.service';
import { mergeConfigPreservingSecrets, redactConfigSecrets } from './rest-auth.util';

/**
 * Module: OEM Integration Hub — no-code data connectors so a business systems manager can wire
 * up a manufacturer/DMS feed (REST pull, REST push/webhook, or MQTT) without writing code, map
 * its fields onto AMX columns or dealer-defined custom fields, and see a run history.
 *
 * This service owns CRUD for connectors/mappings/custom fields; the actual field-mapping/write
 * engine lives in IntegrationIngestService (shared with the REST poller and MQTT subscriber, so
 * this service doesn't need a circular dependency on either of them).
 */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestService: IntegrationIngestService,
  ) {}

  // --- Connectors ------------------------------------------------------------

  async listConnectors(dealerId: string) {
    const connectors = await this.prisma.integrationConnector.findMany({
      where: { dealerId },
      include: { mappings: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return connectors.map((c) => ({ ...c, config: redactConfigSecrets(c.config) }));
  }

  async getConnector(dealerId: string, id: string) {
    const connector = await this.prisma.integrationConnector.findFirst({
      where: { id, dealerId },
      include: { mappings: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    // Never round-trip a saved password/token/API key back to the browser (see rest-auth.util).
    return { ...connector, config: redactConfigSecrets(connector.config) };
  }

  createConnector(dealerId: string, dto: CreateConnectorDto) {
    return this.prisma.integrationConnector.create({
      data: {
        dealerId,
        name: dto.name,
        type: dto.type,
        targetEntity: dto.targetEntity,
        config: (dto.config ?? {}) as never,
        matchField: dto.matchField,
      },
    });
  }

  async updateConnector(dealerId: string, id: string, dto: UpdateConnectorDto) {
    const connector = await this.prisma.integrationConnector.findFirst({ where: { id, dealerId } });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    // A blank password/token/API key field in the request means "unchanged" — the frontend never
    // has the real secret to send back, since getConnector redacts it. See rest-auth.util.
    const mergedConfig = dto.config ? mergeConfigPreservingSecrets(connector.config, dto.config) : undefined;
    const updated = await this.prisma.integrationConnector.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        config: mergedConfig as never,
        matchField: dto.matchField,
      },
    });
    return { ...updated, config: redactConfigSecrets(updated.config) };
  }

  async deleteConnector(dealerId: string, id: string) {
    const connector = await this.prisma.integrationConnector.findFirst({ where: { id, dealerId } });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    await this.prisma.integrationConnector.delete({ where: { id } });
    return { success: true };
  }

  /** Revokes the current inbound webhook URL (e.g. if it leaked) and issues a new one. */
  async regenerateWebhookToken(dealerId: string, id: string) {
    const connector = await this.prisma.integrationConnector.findFirst({ where: { id, dealerId } });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    return this.prisma.integrationConnector.update({ where: { id }, data: { webhookToken: randomUUID() } });
  }

  // --- Field mappings ----------------------------------------------------------

  async setMappings(dealerId: string, connectorId: string, mappings: FieldMappingDto[]) {
    const connector = await this.prisma.integrationConnector.findFirst({ where: { id: connectorId, dealerId } });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    const customFieldKeys = new Set(
      (
        await this.prisma.customFieldDefinition.findMany({
          where: { dealerId, entity: connector.targetEntity },
          select: { key: true },
        })
      ).map((f) => f.key),
    );

    for (const mapping of mappings) {
      if (mapping.isCustomField) {
        if (!customFieldKeys.has(mapping.targetField)) {
          throw new BadRequestException(`Unknown custom field "${mapping.targetField}" — create it first`);
        }
      } else if (!isKnownTargetField(connector.targetEntity as unknown as IntegrationTargetEntity, mapping.targetField)) {
        throw new BadRequestException(`"${mapping.targetField}" is not a mappable field for this entity`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.integrationFieldMapping.deleteMany({ where: { connectorId } });
      await tx.integrationFieldMapping.createMany({
        data: mappings.map((m, index) => ({
          connectorId,
          sourcePath: m.sourcePath,
          targetField: m.targetField,
          isCustomField: m.isCustomField ?? false,
          transform: m.transform,
          sortOrder: m.sortOrder ?? index,
        })),
      });
      return tx.integrationFieldMapping.findMany({ where: { connectorId }, orderBy: { sortOrder: 'asc' } });
    });
  }

  // --- Custom fields -------------------------------------------------------------

  listCustomFields(dealerId: string, entity?: IntegrationTargetEntity) {
    return this.prisma.customFieldDefinition.findMany({
      where: { dealerId, entity: entity || undefined },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCustomField(dealerId: string, dto: CreateCustomFieldDto) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { dealerId_entity_key: { dealerId, entity: dto.entity, key: dto.key } },
    });
    if (existing) {
      throw new BadRequestException('A custom field with this key already exists for this entity');
    }
    return this.prisma.customFieldDefinition.create({
      data: { dealerId, entity: dto.entity, key: dto.key, label: dto.label, dataType: dto.dataType ?? CustomFieldDataType.STRING },
    });
  }

  async deleteCustomField(dealerId: string, id: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({ where: { id, dealerId } });
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }
    await this.prisma.customFieldDefinition.delete({ where: { id } });
    return { success: true };
  }

  /** The full target-field picker for the mapping UI: the fixed AMX allowlist plus this dealer's custom fields. */
  async listTargetFieldOptions(dealerId: string, entity: IntegrationTargetEntity) {
    const customFields = await this.prisma.customFieldDefinition.findMany({ where: { dealerId, entity } });
    return {
      columns: TARGET_ENTITY_FIELDS[entity],
      customFields: customFields.map((f) => ({ key: f.key, label: f.label, dataType: f.dataType })),
    };
  }

  // --- Run logs --------------------------------------------------------------------

  async listRunLogs(dealerId: string, connectorId: string) {
    const connector = await this.prisma.integrationConnector.findFirst({ where: { id: connectorId, dealerId } });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    return this.prisma.integrationRunLog.findMany({ where: { connectorId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  // --- Inbound payload handling (shared by webhook, poller, MQTT, and "send test data") ------

  /**
   * REST_PUSH webhook entrypoint — looked up by the connector's unguessable token, not its id.
   * If the connector has an optional shared-secret header configured, it's checked here too —
   * defence in depth on top of the token itself (e.g. if the URL leaked into a log somewhere).
   */
  async handleWebhook(webhookToken: string, body: unknown, requestHeaders: Record<string, string | string[] | undefined>) {
    const connector = await this.prisma.integrationConnector.findUnique({
      where: { webhookToken },
      include: { mappings: true },
    });
    if (!connector) {
      throw new NotFoundException('Unknown webhook');
    }

    const config = (connector.config ?? {}) as { requiredHeaderName?: string; requiredHeaderValue?: string };
    if (config.requiredHeaderName) {
      const received = requestHeaders[config.requiredHeaderName.toLowerCase()];
      if (received !== config.requiredHeaderValue) {
        throw new ForbiddenException('Missing or incorrect shared-secret header');
      }
    }

    return this.ingestService.ingest(connector, body);
  }

  async testPayload(dealerId: string, connectorId: string, payload: unknown) {
    const connector = await this.prisma.integrationConnector.findFirst({
      where: { id: connectorId, dealerId },
      include: { mappings: true },
    });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    return this.ingestService.ingest(connector, payload);
  }

  // --- UI Screens (custom-field display, built by a business systems manager) -----------------

  private validateScreenFields(entity: IntegrationTargetEntity, fields: ScreenFieldDto[], customFieldKeys: Set<string>) {
    for (const field of fields) {
      if (field.isCustomField) {
        if (!customFieldKeys.has(field.field)) {
          throw new BadRequestException(`Unknown custom field "${field.field}" — create it first`);
        }
      } else if (!isKnownTargetField(entity, field.field)) {
        throw new BadRequestException(`"${field.field}" is not a displayable field for this entity`);
      }
    }
  }

  async getScreen(dealerId: string, entity: IntegrationTargetEntity) {
    const screen = await this.prisma.uiScreenDefinition.findUnique({ where: { dealerId_entity: { dealerId, entity } } });
    return { entity, fields: (screen?.fields as unknown as ScreenFieldDto[] | undefined) ?? [] };
  }

  async saveScreen(dealerId: string, entity: IntegrationTargetEntity, fields: ScreenFieldDto[]) {
    const customFieldKeys = new Set(
      (await this.prisma.customFieldDefinition.findMany({ where: { dealerId, entity }, select: { key: true } })).map(
        (f) => f.key,
      ),
    );
    this.validateScreenFields(entity, fields, customFieldKeys);

    const screen = await this.prisma.uiScreenDefinition.upsert({
      where: { dealerId_entity: { dealerId, entity } },
      update: { fields: fields as never },
      create: { dealerId, entity, fields: fields as never },
    });
    return { entity: screen.entity, fields: screen.fields };
  }

  /** Fetches one record for the Screen Designer preview and the CustomFieldsPanel, dealer-scoped. */
  async getRecord(dealerId: string, entity: IntegrationTargetEntity, id: string) {
    const delegate = (this.prisma as unknown as Record<string, { findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> }>)[
      ENTITY_MODEL_NAME[entity]
    ];
    const record = await delegate.findFirst({ where: { id, dealerId } });
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return record;
  }
}
