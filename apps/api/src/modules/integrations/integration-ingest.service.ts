import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IntegrationRunStatus, IntegrationStatus, IntegrationTargetEntity } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
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
}

/**
 * The actual data-writing engine behind every OEM Integration Hub connector — shared by the
 * REST_PUSH webhook, the REST_PULL poller, the MQTT subscriber, and the "send test data" action.
 * Deliberately its own injectable (rather than living on IntegrationsService) so the poller/MQTT
 * services can depend on just this, without a circular dependency back onto the CRUD service.
 */
@Injectable()
export class IntegrationIngestService {
  private readonly logger = new Logger(IntegrationIngestService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
