import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActionTriggerPoint, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateActionTriggerDto,
  RunActionTriggerDto,
  SetActionTriggerMappingsDto,
  UpdateActionTriggerDto,
} from './dto/action-trigger.dto';
import { ActionTriggersService } from './action-triggers.service';

const MODULE = ModuleKey.OEM_INTEGRATIONS;

@Controller('action-triggers')
export class ActionTriggersController {
  constructor(private readonly actionTriggersService: ActionTriggersService) {}

  @Get()
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  list(@CurrentUser() user: AuthUser, @Query('triggerPoint') triggerPoint?: ActionTriggerPoint) {
    return this.actionTriggersService.list(user.dealerId, triggerPoint);
  }

  @Get(':id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.actionTriggersService.get(user.dealerId, id);
  }

  @Post()
  @RequirePermissions({ module: MODULE, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActionTriggerDto) {
    return this.actionTriggersService.create(user.dealerId, dto);
  }

  @Patch(':id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateActionTriggerDto) {
    return this.actionTriggersService.update(user.dealerId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.DELETE })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.actionTriggersService.delete(user.dealerId, id);
  }

  @Post(':id/mappings')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  setMappings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetActionTriggerMappingsDto) {
    return this.actionTriggersService.setMappings(user.dealerId, id, dto.mappings);
  }

  /** Manual test — runs the trigger for a given search value without needing the real UI flow it's wired into. */
  @Post(':id/test')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  async test(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RunActionTriggerDto) {
    const trigger = await this.actionTriggersService.get(user.dealerId, id);
    return this.actionTriggersService.run(user.dealerId, trigger.triggerPoint as unknown as ActionTriggerPoint, dto.value);
  }
}
