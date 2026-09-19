import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AccountingService } from './accounting.service';
import { CreateIntegrationDto, CreateTransactionDto } from './dto/accounting.dto';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('integrations')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW })
  listIntegrations(@CurrentUser() user: AuthUser) {
    return this.accountingService.listIntegrations(user.dealerId);
  }

  @Post('integrations')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.CREATE })
  createIntegration(@CurrentUser() user: AuthUser, @Body() dto: CreateIntegrationDto) {
    return this.accountingService.createIntegration(user.dealerId, dto);
  }

  @Patch('integrations/:id/mapping')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.EDIT })
  updateMapping(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('accountMappings') accountMappings: Record<string, string>,
  ) {
    return this.accountingService.updateMapping(user.dealerId, id, accountMappings);
  }

  @Get('transactions')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW })
  listTransactions(@CurrentUser() user: AuthUser) {
    return this.accountingService.listTransactions(user.dealerId);
  }

  @Post('transactions')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.CREATE })
  createTransaction(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.accountingService.createTransaction(user.dealerId, dto);
  }

  @Post('transactions/:id/sync')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.EDIT })
  sync(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountingService.sync(user.dealerId, id);
  }

  @Get('reports/reconciliation')
  @RequirePermissions({ module: ModuleKey.ACCOUNTING, action: PermissionAction.VIEW })
  reconciliation(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.accountingService.reconciliation(user.dealerId, new Date(from), new Date(to));
  }
}
