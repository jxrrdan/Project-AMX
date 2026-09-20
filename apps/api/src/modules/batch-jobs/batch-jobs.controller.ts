import { Controller, Get, Param, Post } from '@nestjs/common';
import { BatchJobName, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BatchJobsService } from './batch-jobs.service';

const MODULE = ModuleKey.ADMIN;

@Controller('admin/batch-jobs')
export class BatchJobsController {
  constructor(private readonly batchJobsService: BatchJobsService) {}

  @Get('runs')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  listRuns(@CurrentUser() user: AuthUser) {
    return this.batchJobsService.listRuns(user.dealerId);
  }

  @Post(':jobName/run')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  runNow(@CurrentUser() user: AuthUser, @Param('jobName') jobName: BatchJobName) {
    return this.batchJobsService.runNow(user.dealerId, jobName);
  }
}
