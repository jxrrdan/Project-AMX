import { Body, Controller, Get, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ModuleKey, PaymentSourceType, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TakePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  list(@CurrentUser() user: AuthUser) {
    return this.paymentsService.list(user.dealerId);
  }

  @Post(':sourceType/:sourceId')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  pay(
    @CurrentUser() user: AuthUser,
    @Param('sourceType', new ParseEnumPipe(PaymentSourceType)) sourceType: PaymentSourceType,
    @Param('sourceId') sourceId: string,
    @Body() dto: TakePaymentDto,
  ) {
    return this.paymentsService.pay(user.dealerId, sourceType, sourceId, dto.method);
  }

  /** No login required — the invoice id itself, an unguessable UUID, is the access control,
   * the same convention VhcController's public report route already uses. */
  @Public()
  @Get('public/:sourceType/:sourceId')
  getPayable(
    @Param('sourceType', new ParseEnumPipe(PaymentSourceType)) sourceType: PaymentSourceType,
    @Param('sourceId') sourceId: string,
  ) {
    return this.paymentsService.findPayable(sourceType, sourceId);
  }

  @Public()
  @Post('public/:sourceType/:sourceId')
  payPublic(
    @Param('sourceType', new ParseEnumPipe(PaymentSourceType)) sourceType: PaymentSourceType,
    @Param('sourceId') sourceId: string,
    @Body() dto: TakePaymentDto,
  ) {
    return this.paymentsService.payPublic(sourceType, sourceId, dto.method);
  }
}
