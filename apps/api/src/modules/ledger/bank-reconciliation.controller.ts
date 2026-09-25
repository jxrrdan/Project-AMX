import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BankReconciliationService } from './bank-reconciliation.service';
import { ImportBankStatementDto, MatchBankLineDto } from './dto/bank-reconciliation.dto';

@Controller('ledger/bank-reconciliation')
export class BankReconciliationController {
  constructor(private readonly bankReconciliationService: BankReconciliationService) {}

  @Get('lines')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listBankLines(@CurrentUser() user: AuthUser) {
    return this.bankReconciliationService.listBankLines(user.dealerId);
  }

  @Get('unmatched-journal-lines')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.VIEW })
  listUnmatchedJournalLines(@CurrentUser() user: AuthUser) {
    return this.bankReconciliationService.listUnmatchedJournalLines(user.dealerId);
  }

  @Post('import')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.CREATE })
  importStatement(@CurrentUser() user: AuthUser, @Body() dto: ImportBankStatementDto) {
    return this.bankReconciliationService.importStatementLines(user.dealerId, dto.lines);
  }

  @Post('lines/:id/match')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  matchLine(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MatchBankLineDto) {
    return this.bankReconciliationService.matchManually(user.dealerId, id, dto.journalLineId);
  }

  @Post('lines/:id/unmatch')
  @RequirePermissions({ module: ModuleKey.GENERAL_LEDGER, action: PermissionAction.EDIT })
  unmatchLine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bankReconciliationService.unmatch(user.dealerId, id);
  }
}
