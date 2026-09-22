import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateNominalAccountDto, PostJournalDto, VatReturnPeriodDto } from './dto/ledger.dto';
import { LedgerService } from './ledger.service';
import { MtdSubmissionService } from './mtd-submission.service';

@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly mtdSubmissionService: MtdSubmissionService,
  ) {}

  @Get('accounts')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.ledgerService.listAccounts(user.dealerId);
  }

  @Post('accounts')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateNominalAccountDto) {
    return this.ledgerService.createAccount(user.dealerId, dto);
  }

  @Get('journal')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listJournal(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ledgerService.listJournal(user.dealerId, from, to);
  }

  @Post('journal')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  postJournal(@CurrentUser() user: AuthUser, @Body() dto: PostJournalDto) {
    return this.ledgerService.postManual(user.dealerId, dto, user.id);
  }

  @Get('sales-ledger')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  salesLedger(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ledgerService.salesLedger(user.dealerId, from, to);
  }

  @Get('purchase-ledger')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  purchaseLedger(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ledgerService.purchaseLedger(user.dealerId, from, to);
  }

  @Get('vehicle-ledger')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  vehicleLedger(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ledgerService.vehicleLedger(user.dealerId, from, to);
  }

  @Get('vat-return/compute')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  computeVatReturn(@CurrentUser() user: AuthUser, @Query() query: VatReturnPeriodDto) {
    return this.ledgerService.computeVatReturn(user.dealerId, query.periodStart, query.periodEnd);
  }

  @Post('vat-returns')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  saveVatReturn(@CurrentUser() user: AuthUser, @Body() dto: VatReturnPeriodDto) {
    return this.ledgerService.saveVatReturn(user.dealerId, dto.periodStart, dto.periodEnd);
  }

  @Get('vat-returns')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listVatReturns(@CurrentUser() user: AuthUser) {
    return this.ledgerService.listVatReturns(user.dealerId);
  }

  @Post('vat-returns/:id/submit')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  submitVatReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mtdSubmissionService.submit(user.dealerId, id);
  }
}
