import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction, VehiclePipelineStatus } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CompleteHandoverDto, CreateHandoverDto } from './dto/handover.dto';
import { SchedulePdiDto, SignOffPdiDto, UpdateChecklistItemDto } from './dto/pdi.dto';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { HandoverService } from './handover.service';
import { PdiService } from './pdi.service';
import { RisImportService } from './ris-import.service';
import { VehiclesService } from './vehicles.service';

@Controller()
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly pdiService: PdiService,
    private readonly handoverService: HandoverService,
    private readonly risImportService: RisImportService,
  ) {}

  @Get('vehicles')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.VIEW })
  listPipeline(
    @CurrentUser() user: AuthUser,
    @Query('model') model?: string,
    @Query('advisorId') advisorId?: string,
    @Query('status') status?: VehiclePipelineStatus,
  ) {
    return this.vehiclesService.listPipeline(user.dealerId, model, advisorId, status);
  }

  @Get('vehicles/:id')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vehiclesService.findOne(user.dealerId, id);
  }

  @Post('vehicles')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(user.dealerId, dto);
  }

  @Patch('vehicles/:id')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.EDIT })
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.updateStatus(user.dealerId, id, dto, user.id);
  }

  /** Manual trigger for the mock RIS import — lets the pipeline board be demoed without waiting on the 30-minute cron. */
  @Post('vehicles/import-mock-order')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.CREATE })
  importMockOrder(@CurrentUser() user: AuthUser) {
    return this.risImportService.importOneMockOrder(user.dealerId);
  }

  @Post('vehicles/:id/pdi')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.CREATE })
  schedulePdi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SchedulePdiDto) {
    return this.pdiService.schedule(user.dealerId, id, dto, user.id);
  }

  @Patch('pdi-checklist-items/:id')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.EDIT })
  updateChecklistItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.pdiService.updateChecklistItem(user.dealerId, id, dto);
  }

  @Post('pdi/:id/sign-off')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.APPROVE })
  signOffPdi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SignOffPdiDto) {
    return this.pdiService.signOff(user.dealerId, id, dto, user.id);
  }

  @Get('handovers')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.VIEW })
  listHandovers(@CurrentUser() user: AuthUser) {
    return this.handoverService.list(user.dealerId);
  }

  @Post('handovers')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.CREATE })
  createHandover(@CurrentUser() user: AuthUser, @Body() dto: CreateHandoverDto) {
    return this.handoverService.create(user.dealerId, dto);
  }

  @Post('handovers/:id/complete')
  @RequirePermissions({ module: ModuleKey.NEW_CAR_PDI, action: PermissionAction.EDIT })
  completeHandover(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CompleteHandoverDto) {
    return this.handoverService.complete(user.dealerId, id, dto);
  }
}
