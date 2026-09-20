import { Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AftersalesInvoiceService } from './aftersales-invoice.service';

@Controller('job-cards/:id/invoice')
export class AftersalesInvoiceController {
  constructor(private readonly aftersalesInvoiceService: AftersalesInvoiceService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aftersalesInvoiceService.get(user.dealerId, id);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.WORKSHOP, action: PermissionAction.EDIT })
  generate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aftersalesInvoiceService.generate(user.dealerId, id);
  }
}
