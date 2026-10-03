import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateServiceHistoryEntryDto } from './dto/parc.dto';
import { ParcService } from './parc.service';

@Controller('parc')
export class ParcController {
  constructor(private readonly service: ParcService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.VEHICLE_PARC, action: PermissionAction.VIEW })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.dealerId);
  }

  @Post('entries')
  @RequirePermissions({ module: ModuleKey.VEHICLE_PARC, action: PermissionAction.CREATE })
  addEntry(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceHistoryEntryDto) {
    return this.service.addEntry(user.dealerId, dto);
  }

  @Get(':reg')
  @RequirePermissions({ module: ModuleKey.VEHICLE_PARC, action: PermissionAction.VIEW })
  lookup(@CurrentUser() user: AuthUser, @Param('reg') reg: string) {
    return this.service.lookup(user.dealerId, reg);
  }
}
