import { Controller, Get } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ReportingService } from './reporting.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('doc')
  @RequirePermissions({ module: ModuleKey.MANAGEMENT_REPORTING, action: PermissionAction.VIEW })
  doc(@CurrentUser() user: AuthUser) {
    return this.service.doc(user.dealerId);
  }
}
