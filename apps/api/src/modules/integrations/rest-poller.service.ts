import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationRunStatus, IntegrationStatus, IntegrationType } from '@project-amx/shared';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertSafeOutboundUrl } from '../../common/security/outbound-url.util';
import { resolvePath } from './field-mapping.util';
import { IngestableConnector, IntegrationIngestService } from './integration-ingest.service';
import { buildRequestHeaders, HeaderPair, RestAuthConfig } from './rest-auth.util';

interface RestPullConfig {
  url?: string;
  method?: 'GET' | 'POST';
  /** Custom headers as key/value pairs (rather than a plain object) so the UI can offer an add/remove row editor. */
  headers?: HeaderPair[];
  auth?: RestAuthConfig;
  /** Dot-path into the response body where the array of records lives, e.g. "data.vehicles". Omit if the body itself is the array/record. */
  resultsPath?: string;
  pollIntervalMinutes?: number;
}

/**
 * Polls every ACTIVE REST_PULL connector on its own configured interval using a real HTTP GET/POST
 * (via axios — the same request an OEM's REST API would receive in production). A connector with
 * no reachable `url` (the common case in this sandbox, with no real OEM endpoint to poll) simply
 * records the failure on its next due tick and keeps retrying — verify a REST_PULL mapping
 * locally via the connector's "send test data" action instead of a live poll.
 */
@Injectable()
export class RestPollerService {
  private readonly logger = new Logger(RestPollerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestService: IntegrationIngestService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollDueConnectors() {
    const connectors = await this.prisma.integrationConnector.findMany({
      where: { type: IntegrationType.REST_PULL, status: IntegrationStatus.ACTIVE },
      include: { mappings: true },
    });

    for (const connector of connectors) {
      if (this.isDue(connector)) {
        await this.poll(connector);
      }
    }
  }

  private isDue(connector: { lastRunAt: Date | null; config: unknown }): boolean {
    const { pollIntervalMinutes = 15 } = (connector.config ?? {}) as RestPullConfig;
    if (!connector.lastRunAt) return true;
    return Date.now() - connector.lastRunAt.getTime() >= pollIntervalMinutes * 60_000;
  }

  private async poll(connector: IngestableConnector & { config: unknown }) {
    const config = (connector.config ?? {}) as RestPullConfig;
    if (!config.url) {
      this.logger.warn(`REST_PULL connector ${connector.id} has no url configured — skipping`);
      return;
    }

    try {
      assertSafeOutboundUrl(config.url);
      const response = await axios.request({
        url: config.url,
        method: config.method ?? 'GET',
        headers: buildRequestHeaders(config.headers, config.auth),
        timeout: 15_000,
      });
      const records = config.resultsPath ? resolvePath(response.data, config.resultsPath) : response.data;
      await this.ingestService.ingest(connector, records ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Poll request failed';
      this.logger.warn(`Poll failed for connector ${connector.id}: ${message}`);
      await this.prisma.integrationConnector.update({
        where: { id: connector.id },
        data: { lastRunAt: new Date(), lastError: message, status: IntegrationStatus.ERROR },
      });
      await this.prisma.integrationRunLog.create({
        data: { connectorId: connector.id, status: IntegrationRunStatus.ERROR, recordsIn: 0, recordsMapped: 0, errorMessage: message },
      });
    }
  }
}
