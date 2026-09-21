import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigScope, IntegrationRunStatus, IntegrationStatus, IntegrationTargetEntity } from '@project-amx/shared';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertSafeOutboundUrl } from '../../common/security/outbound-url.util';
import { TenancyScopeService } from '../../common/tenancy/tenancy-scope.service';
import { applyTransform, coerceForColumn, ENTITY_MODEL_NAME, isKnownTargetField, resolvePath } from './field-mapping.util';

interface TargetDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
}

export interface IngestableConnector {
  id: string;
  dealerId: string;
  targetEntity: string;
  matchField: string | null;
  mappings: { sourcePath: string; targetField: string; isCustomField: boolean; transform: string | null }[];
  /** Present on every real Prisma row; only spelled out on the mock connectors in tests that need it. */
  config?: unknown;
}

interface ModelEnrichmentConfig {
  /** e.g. "https://oem.example.com/models/{model}" — {model} is replaced with the normalised model name. */
  metadataUrlTemplate?: string;
  /** Dot-path into the response body where the metadata object lives, if it's nested. */
  resultsPath?: string;
}

const ENRICHABLE_ENTITIES = new Set([IntegrationTargetEntity.VEHICLE, IntegrationTargetEntity.USED_VEHICLE]);

/**
 * The actual data-writing engine behind every OEM Integration Hub connector — shared by the
 * REST_PUSH webhook, the REST_PULL poller, the MQTT subscriber, and the "send test data" action.
 * Deliberately its own injectable (rather than living on IntegrationsService) so the poller/MQTT
 * services can depend on just this, without a circular dependency back onto the CRUD service.
 */
@Injectable()
export class IntegrationIngestService {
  private readonly logger = new Logger(IntegrationIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyScopeService,
  ) {}

  /** Runs one inbound payload (a single record, or an array of records) through the mapping engine. */
  async ingest(connector: IngestableConnector, rawPayload: unknown) {
    const records = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    let mapped = 0;
    let errorMessage: string | undefined;

    try {
      for (const record of records) {
        await this.mapAndUpsert(connector, record);
        mapped += 1;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Integration connector ${connector.id} ingest failed: ${errorMessage}`);
    }

    await this.prisma.integrationConnector.update({
      where: { id: connector.id },
      data: {
        lastRunAt: new Date(),
        lastError: errorMessage ?? null,
        status: errorMessage ? IntegrationStatus.ERROR : undefined,
      },
    });
    await this.prisma.integrationRunLog.create({
      data: {
        connectorId: connector.id,
        status: errorMessage ? IntegrationRunStatus.ERROR : IntegrationRunStatus.SUCCESS,
        recordsIn: records.length,
        recordsMapped: mapped,
        errorMessage,
        rawPayloadSample: (records[0] ?? null) as never,
      },
    });

    if (errorMessage) {
      throw new BadRequestException(errorMessage);
    }
    return { recordsIn: records.length, recordsMapped: mapped };
  }

  private async mapAndUpsert(connector: IngestableConnector, record: unknown) {
    const entity = connector.targetEntity as unknown as IntegrationTargetEntity;
    const columnValues: Record<string, unknown> = {};
    const customFieldValues: Record<string, unknown> = {};

    for (const mapping of connector.mappings) {
      const raw = resolvePath(record, mapping.sourcePath);
      const transformed = applyTransform(raw, mapping.transform);
      if (transformed === undefined) continue;

      if (mapping.isCustomField) {
        customFieldValues[mapping.targetField] = transformed;
      } else if (isKnownTargetField(entity, mapping.targetField)) {
        columnValues[mapping.targetField] = coerceForColumn(mapping.targetField, transformed);
      }
    }

    if (ENRICHABLE_ENTITIES.has(entity)) {
      await this.enrichWithModelMetadata(connector, columnValues, customFieldValues);
    }

    const delegate = this.delegateFor(entity);
    // Every lookup and write is scoped to this connector's own dealer — an inbound payload must
    // never be able to match, and therefore silently overwrite, another dealer's record.
    const existing =
      connector.matchField && columnValues[connector.matchField] !== undefined
        ? await delegate.findFirst({
            where: { dealerId: connector.dealerId, [connector.matchField]: columnValues[connector.matchField] },
          })
        : null;

    if (existing) {
      const mergedCustomFields = { ...((existing.customFields as Record<string, unknown>) ?? {}), ...customFieldValues };
      return delegate.update({
        where: { id: existing.id as string },
        data: { ...columnValues, customFields: mergedCustomFields },
      });
    }

    return delegate.create({
      data: { ...columnValues, dealerId: connector.dealerId, customFields: customFieldValues },
    });
  }

  private delegateFor(entity: IntegrationTargetEntity): TargetDelegate {
    return (this.prisma as unknown as Record<string, TargetDelegate>)[ENTITY_MODEL_NAME[entity]];
  }

  /**
   * Conditional post-mapping workflow: when this connector's payload carries a "model" (VEHICLE
   * and USED_VEHICLE both map that field already — see field-mapping.util's TARGET_ENTITY_FIELDS)
   * and the connector has an OEM metadata API configured, checks whether AMX already knows this
   * model before doing anything else. A cache hit needs no external call; a miss (e.g. a new MINI
   * derivative nobody's stored yet) calls the configured API once, caches the result, and merges
   * it into this record's custom fields — the same "call another API or look it up" branching the
   * business systems manager wants, but reusing this shared ingest engine (REST_PULL, REST_PUSH,
   * and MQTT all funnel through it) rather than special-casing any one transport.
   *
   * Never fails the ingest: an unreachable/misconfigured metadata API just means this record is
   * stored without the extra metadata, same graceful-degradation contract as ActionTriggersService.run().
   */
  private async enrichWithModelMetadata(
    connector: IngestableConnector,
    columnValues: Record<string, unknown>,
    customFieldValues: Record<string, unknown>,
  ): Promise<void> {
    const config = ((connector.config ?? {}) as { modelEnrichment?: ModelEnrichmentConfig }).modelEnrichment;
    const rawModel = columnValues['model'];
    if (!config?.metadataUrlTemplate || typeof rawModel !== 'string' || !rawModel.trim()) {
      return;
    }
    const modelKey = rawModel.trim().toLowerCase();

    try {
      const ctx = await this.tenancy.resolve(connector.dealerId);
      for (const clause of this.tenancy.scopeWhereClauses(ctx)) {
        const cached = await this.prisma.vehicleModelMetadata.findFirst({ where: { ...clause, modelKey } });
        if (cached) {
          customFieldValues['modelMetadata'] = cached.data;
          return;
        }
      }

      // Not seen before anywhere in this dealer's/franchise's/group's cache — fetch it once.
      const url = config.metadataUrlTemplate.replace('{model}', encodeURIComponent(modelKey));
      assertSafeOutboundUrl(url);
      const response = await axios.request({ url, method: 'GET', timeout: 10_000 });
      const data = config.resultsPath ? resolvePath(response.data, config.resultsPath) : response.data;

      // A franchise-wide brand (e.g. every MINI outlet) benefits from sharing this fetch; fall
      // back to this dealer alone when it isn't assigned to a franchise yet.
      const scope = ctx.franchiseId ? ConfigScope.FRANCHISE : ConfigScope.DEALER;
      await this.prisma.vehicleModelMetadata.create({
        data: {
          scope,
          dealerId: scope === ConfigScope.DEALER ? ctx.dealerId : undefined,
          franchiseId: scope === ConfigScope.FRANCHISE ? ctx.franchiseId : undefined,
          modelKey,
          data: (data ?? {}) as never,
        },
      });
      customFieldValues['modelMetadata'] = data ?? {};
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Model metadata lookup for "${modelKey}" failed on connector ${connector.id} — storing without it: ${message}`);
    }
  }
}
