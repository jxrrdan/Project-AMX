import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationStatus, IntegrationType } from '@project-amx/shared';
import * as mqtt from 'mqtt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IngestableConnector, IntegrationIngestService } from './integration-ingest.service';

interface MqttConnectorConfig {
  brokerUrl?: string;
  topic?: string;
  username?: string;
  password?: string;
}

/**
 * Real MQTT ingestion for ACTIVE connectors of type MQTT: connects to whatever broker the
 * business systems manager configured with the genuine `mqtt` client library — the same code
 * runs against a manufacturer's real broker in production. There's no bundled local broker for
 * this sandbox to dial, so local testing of a mapping goes through the connector's "send test
 * data" action (IntegrationsService.testPayload) instead of a live subscription — the
 * field-mapping/write engine exercised is identical either way.
 *
 * Subscriptions are reconciled on a timer (rather than event-driven from connector CRUD) so a
 * connector activated, paused, reconfigured, or deleted converges within a minute with no
 * circular dependency back onto IntegrationsService.
 */
@Injectable()
export class MqttIngestService implements OnModuleDestroy {
  private readonly logger = new Logger(MqttIngestService.name);
  private readonly clients = new Map<string, mqtt.MqttClient>();
  private readonly subscribedConfig = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestService: IntegrationIngestService,
  ) {}

  onModuleDestroy() {
    for (const client of this.clients.values()) {
      client.end(true);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile() {
    const activeConnectors = await this.prisma.integrationConnector.findMany({
      where: { type: IntegrationType.MQTT, status: IntegrationStatus.ACTIVE },
      include: { mappings: true },
    });
    const activeIds = new Set(activeConnectors.map((c) => c.id));

    for (const id of this.clients.keys()) {
      if (!activeIds.has(id)) {
        this.unsubscribe(id);
      }
    }

    for (const connector of activeConnectors) {
      const configKey = JSON.stringify(connector.config);
      if (this.subscribedConfig.get(connector.id) === configKey) {
        continue;
      }
      this.subscribe(connector, configKey);
    }
  }

  private subscribe(connector: IngestableConnector & { config: unknown }, configKey: string) {
    this.unsubscribe(connector.id);
    const config = (connector.config ?? {}) as MqttConnectorConfig;
    if (!config.brokerUrl || !config.topic) {
      this.logger.warn(`MQTT connector ${connector.id} is missing brokerUrl/topic — not subscribing`);
      return;
    }

    const client = mqtt.connect(config.brokerUrl, {
      username: config.username,
      password: config.password,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
    });

    client.on('connect', () => client.subscribe(config.topic as string));
    client.on('message', (_topic, payload) => {
      void this.handleMessage(connector, payload);
    });
    client.on('error', (err) => this.logger.warn(`MQTT connector ${connector.id} error: ${err.message}`));

    this.clients.set(connector.id, client);
    this.subscribedConfig.set(connector.id, configKey);
  }

  private async handleMessage(connector: IngestableConnector, payload: Buffer) {
    try {
      const json = JSON.parse(payload.toString('utf8'));
      await this.ingestService.ingest(connector, json);
    } catch (err) {
      this.logger.warn(`MQTT connector ${connector.id} could not process message: ${err instanceof Error ? err.message : err}`);
    }
  }

  private unsubscribe(connectorId: string) {
    const client = this.clients.get(connectorId);
    if (client) {
      client.end(true);
      this.clients.delete(connectorId);
      this.subscribedConfig.delete(connectorId);
    }
  }
}
