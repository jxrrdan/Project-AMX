import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AddAccountTransactionDto, CreateAccountCustomerDto, UpdateAccountCustomerDto } from './dto/account-customer.dto';
import { AccountCustomersService } from './account-customers.service';

@Controller('account-customers')
export class AccountCustomersController {
  constructor(private readonly service: AccountCustomersService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser, @Query('active') active?: string) {
    return this.service.findAll(user.dealerId, active === undefined ? undefined : active === 'true');
  }

  @Get('reports/aged-debtors')
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.VIEW })
  agedDebtors(@CurrentUser() user: AuthUser) {
    return this.service.agedDebtors(user.dealerId);
  }

  @Get(':id')
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.dealerId, id);
  }

  @Get(':id/statement')
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.VIEW })
  statement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.statement(user.dealerId, id, from, to);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountCustomerDto) {
    return this.service.create(user.dealerId, dto);
  }

  @Patch(':id')
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAccountCustomerDto) {
    return this.service.update(user.dealerId, id, dto);
  }

  @Post(':id/transactions')
  @RequirePermissions({ module: ModuleKey.ACCOUNT_CUSTOMERS, action: PermissionAction.EDIT })
  addTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddAccountTransactionDto) {
    return this.service.addTransaction(user.dealerId, id, dto);
  }
}
