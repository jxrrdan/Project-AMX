import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { IntegrationTargetEntity, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateConnectorDto,
  CreateCustomFieldDto,
  SaveScreenDto,
  SetMappingsDto,
  TestPayloadDto,
  UpdateConnectorDto,
} from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

const MODULE = ModuleKey.OEM_INTEGRATIONS;

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('integrations/connectors')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  listConnectors(@CurrentUser() user: AuthUser) {
    return this.integrationsService.listConnectors(user.dealerId);
  }

  @Get('integrations/connectors/:id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  getConnector(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrationsService.getConnector(user.dealerId, id);
  }

  @Post('integrations/connectors')
  @RequirePermissions({ module: MODULE, action: PermissionAction.CREATE })
  createConnector(@CurrentUser() user: AuthUser, @Body() dto: CreateConnectorDto) {
    return this.integrationsService.createConnector(user.dealerId, dto);
  }

  @Patch('integrations/connectors/:id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  updateConnector(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateConnectorDto) {
    return this.integrationsService.updateConnector(user.dealerId, id, dto);
  }

  @Delete('integrations/connectors/:id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.DELETE })
  deleteConnector(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrationsService.deleteConnector(user.dealerId, id);
  }

  @Post('integrations/connectors/:id/regenerate-webhook-token')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  regenerateWebhookToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrationsService.regenerateWebhookToken(user.dealerId, id);
  }

  @Post('integrations/connectors/:id/mappings')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  setMappings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetMappingsDto) {
    return this.integrationsService.setMappings(user.dealerId, id, dto.mappings);
  }

  @Post('integrations/connectors/:id/test')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  testPayload(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TestPayloadDto) {
    return this.integrationsService.testPayload(user.dealerId, id, dto.payload);
  }

  @Get('integrations/connectors/:id/run-logs')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  listRunLogs(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrationsService.listRunLogs(user.dealerId, id);
  }

  @Get('integrations/target-fields')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  listTargetFieldOptions(@CurrentUser() user: AuthUser, @Query('entity') entity: IntegrationTargetEntity) {
    return this.integrationsService.listTargetFieldOptions(user.dealerId, entity);
  }

  @Get('integrations/custom-fields')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  listCustomFields(@CurrentUser() user: AuthUser, @Query('entity') entity?: IntegrationTargetEntity) {
    return this.integrationsService.listCustomFields(user.dealerId, entity);
  }

  @Post('integrations/custom-fields')
  @RequirePermissions({ module: MODULE, action: PermissionAction.CREATE })
  createCustomField(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomFieldDto) {
    return this.integrationsService.createCustomField(user.dealerId, dto);
  }

  @Delete('integrations/custom-fields/:id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.DELETE })
  deleteCustomField(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrationsService.deleteCustomField(user.dealerId, id);
  }

  /**
   * Inbound REST_PUSH webhook — deliberately gated on the connector's own unguessable
   * `webhookToken`, never a plain id, same pattern as the workshop TV board's token.
   */
  @Public()
  @Post('integrations/webhooks/:webhookToken')
  receiveWebhook(@Param('webhookToken') webhookToken: string, @Body() body: unknown, @Headers() headers: Record<string, string>) {
    return this.integrationsService.handleWebhook(webhookToken, body, headers);
  }

  /** Custom-field display layout for an entity, built by a business systems manager (Screen Designer). */
  @Get('integrations/screens/:entity')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  getScreen(@CurrentUser() user: AuthUser, @Param('entity') entity: IntegrationTargetEntity) {
    return this.integrationsService.getScreen(user.dealerId, entity);
  }

  @Post('integrations/screens/:entity')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  saveScreen(@CurrentUser() user: AuthUser, @Param('entity') entity: IntegrationTargetEntity, @Body() dto: SaveScreenDto) {
    return this.integrationsService.saveScreen(user.dealerId, entity, dto.fields);
  }

  /** Backs both the Screen Designer's live preview and each module's embedded CustomFieldsPanel. */
  @Get('integrations/records/:entity/:id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  getRecord(@CurrentUser() user: AuthUser, @Param('entity') entity: IntegrationTargetEntity, @Param('id') id: string) {
    return this.integrationsService.getRecord(user.dealerId, entity, id);
  }

  /**
   * A canned OEM-shaped feed, purely so a REST_PULL connector can be pointed at *something* real
   * over HTTP while testing a mapping locally — there's no actual manufacturer endpoint to poll
   * in this environment. Same role as DvlaService's mock driver: a stand-in for an external
   * system this sandbox can't reach, not a real integration.
   */
  @Public()
  @Get('integrations/_sample-oem-feed/vehicles')
  sampleOemVehicleFeed() {
    return {
      vehicles: [
        { vin: 'WBA1SAMPLE0000001', model: 'BMW 3 Series Touring', colour: 'Alpine White', oemOrderRef: 'RIS-SAMPLE-1', oemNetworkCode: 'GB-045' },
        { vin: 'WBA1SAMPLE0000002', model: 'BMW X1', colour: 'Black Sapphire', oemOrderRef: 'RIS-SAMPLE-2', oemNetworkCode: 'GB-045' },
      ],
    };
  }
}
