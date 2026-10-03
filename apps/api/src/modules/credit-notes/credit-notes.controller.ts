import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreditNoteStatus, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateCreditNoteDto, UpdateCreditNoteDto } from './dto/credit-note.dto';
import { CreditNotesService } from './credit-notes.service';

@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: CreditNoteStatus) {
    return this.creditNotesService.findAll(user.dealerId, status);
  }

  @Get(':id')
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.creditNotesService.findOne(user.dealerId, id);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(user.dealerId, dto);
  }

  @Patch(':id')
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCreditNoteDto) {
    return this.creditNotesService.update(user.dealerId, id, dto);
  }

  @Post(':id/issue')
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.APPROVE })
  issue(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.creditNotesService.issue(user.dealerId, id);
  }

  @Post(':id/apply')
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.EDIT })
  apply(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.creditNotesService.apply(user.dealerId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions({ module: ModuleKey.CREDIT_NOTES, action: PermissionAction.EDIT })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.creditNotesService.cancel(user.dealerId, id);
  }
}
