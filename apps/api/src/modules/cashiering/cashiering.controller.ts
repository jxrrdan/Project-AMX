import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ModuleKey, PaymentKind, PaymentMethod, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreatePaymentDto } from './dto/payment.dto';
import { CashieringService } from './cashiering.service';

@Controller('payments')
export class CashieringController {
  constructor(private readonly service: CashieringService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.CASHIERING, action: PermissionAction.VIEW })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('kind') kind?: PaymentKind,
    @Query('method') method?: PaymentMethod,
    @Query('date') date?: string,
  ) {
    return this.service.findAll(user.dealerId, { kind, method, date });
  }

  @Get('reconciliation')
  @RequirePermissions({ module: ModuleKey.CASHIERING, action: PermissionAction.VIEW })
  reconciliation(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.service.reconciliation(user.dealerId, date);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.CASHIERING, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.service.create(user.dealerId, dto, `${user.firstName} ${user.lastName}`);
  }
}
