import { Module } from '@nestjs/common';
import { IntegrationIngestService } from './integration-ingest.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { MqttIngestService } from './mqtt-ingest.service';
import { RestPollerService } from './rest-poller.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationIngestService, RestPollerService, MqttIngestService],
})
export class IntegrationsModule {}
