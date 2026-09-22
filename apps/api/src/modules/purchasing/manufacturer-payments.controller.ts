import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateManufacturerPaymentBatchDto } from './dto/manufacturer-payment.dto';
import { ManufacturerPaymentsService } from './manufacturer-payments.service';

@Controller('manufacturer-payment-batches')
export class ManufacturerPaymentsController {
  constructor(private readonly manufacturerPaymentsService: ManufacturerPaymentsService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listBatches(@CurrentUser() user: AuthUser) {
    return this.manufacturerPaymentsService.listBatches(user.dealerId);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  createBatch(@CurrentUser() user: AuthUser, @Body() dto: CreateManufacturerPaymentBatchDto) {
    return this.manufacturerPaymentsService.createBatch(user.dealerId, dto);
  }

  @Get(':id')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  findBatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.manufacturerPaymentsService.findBatch(user.dealerId, id);
  }

  @Post(':id/reconcile')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  reconcileBatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.manufacturerPaymentsService.reconcileBatch(user.dealerId, id);
  }

  @Post(':id/post')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  postBatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.manufacturerPaymentsService.postBatch(user.dealerId, id);
  }
}
