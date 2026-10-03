import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction, RecallCampaignStatus } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AddRecallVehicleDto,
  CreateRecallCampaignDto,
  UpdateRecallCampaignDto,
  UpdateRecallVehicleDto,
} from './dto/recall.dto';
import { RecallsService } from './recalls.service';

@Controller()
export class RecallsController {
  constructor(private readonly recallsService: RecallsService) {}

  @Get('recalls')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.VIEW })
  list(@CurrentUser() user: AuthUser, @Query('status') status?: RecallCampaignStatus) {
    return this.recallsService.listCampaigns(user.dealerId, status);
  }

  @Get('recalls/summary')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.VIEW })
  summary(@CurrentUser() user: AuthUser) {
    return this.recallsService.outstandingSummary(user.dealerId);
  }

  @Get('recalls/:id')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.recallsService.findOne(user.dealerId, id);
  }

  @Post('recalls')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRecallCampaignDto) {
    return this.recallsService.createCampaign(user.dealerId, dto);
  }

  @Patch('recalls/:id')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRecallCampaignDto) {
    return this.recallsService.updateCampaign(user.dealerId, id, dto);
  }

  @Post('recalls/:id/vehicles')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.CREATE })
  addVehicle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddRecallVehicleDto) {
    return this.recallsService.addVehicle(user.dealerId, id, dto);
  }

  @Patch('recall-vehicles/:id')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.EDIT })
  updateVehicle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRecallVehicleDto) {
    return this.recallsService.updateVehicle(user.dealerId, id, dto);
  }

  @Delete('recall-vehicles/:id')
  @RequirePermissions({ module: ModuleKey.RECALLS, action: PermissionAction.DELETE })
  removeVehicle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.recallsService.removeVehicle(user.dealerId, id);
  }
}
