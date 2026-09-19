import { Controller, Get } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @RequirePermissions({ module: ModuleKey.DASHBOARD, action: PermissionAction.VIEW })
  kpis(@CurrentUser() user: AuthUser) {
    return this.dashboardService.kpis(user.dealerId);
  }
}
