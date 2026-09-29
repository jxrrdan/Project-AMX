import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateServicePlanDto,
  CreateSubscriptionDto,
  UpdateServicePlanDto,
  UpdateSubscriptionDto,
} from './dto/service-plan.dto';
import { ServicePlansService } from './service-plans.service';

@Controller('service-plans')
export class ServicePlansController {
  constructor(private readonly service: ServicePlansService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.VIEW })
  listPlans(@CurrentUser() user: AuthUser) {
    return this.service.listPlans(user.dealerId);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.CREATE })
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreateServicePlanDto) {
    return this.service.createPlan(user.dealerId, dto);
  }

  @Patch(':id')
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.EDIT })
  updatePlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateServicePlanDto) {
    return this.service.updatePlan(user.dealerId, id, dto);
  }

  // --- Subscriptions & reminders -------------------------------------------

  @Get('subscriptions/all')
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.VIEW })
  listSubscriptions(@CurrentUser() user: AuthUser) {
    return this.service.listSubscriptions(user.dealerId);
  }

  @Get('reminders/summary')
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.VIEW })
  dueSummary(@CurrentUser() user: AuthUser) {
    return this.service.dueSummary(user.dealerId);
  }

  @Post('subscriptions')
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.CREATE })
  createSubscription(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.service.createSubscription(user.dealerId, dto);
  }

  @Patch('subscriptions/:id')
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.EDIT })
  updateSubscription(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.service.updateSubscription(user.dealerId, id, dto);
  }

  @Post('reminders/run')
  @RequirePermissions({ module: ModuleKey.SERVICE_PLANS, action: PermissionAction.EDIT })
  runReminders(@CurrentUser() user: AuthUser) {
    return this.service.runDueReminders(user.dealerId);
  }
}
