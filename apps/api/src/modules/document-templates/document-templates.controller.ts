import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DocumentTemplateType, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateDocumentTemplateDto, UpdateDocumentTemplateDto } from './dto/document-template.dto';
import { DocumentTemplatesService } from './document-templates.service';

const MODULE = ModuleKey.ADMIN;

@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly documentTemplatesService: DocumentTemplatesService) {}

  @Get()
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  list(@CurrentUser() user: AuthUser, @Query('type') type?: DocumentTemplateType) {
    return this.documentTemplatesService.list(user.dealerId, type);
  }

  @Get(':id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.VIEW })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentTemplatesService.get(user.dealerId, id);
  }

  @Post()
  @RequirePermissions({ module: MODULE, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentTemplateDto) {
    return this.documentTemplatesService.create(user.dealerId, dto);
  }

  @Patch(':id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.documentTemplatesService.update(user.dealerId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({ module: MODULE, action: PermissionAction.DELETE })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentTemplatesService.delete(user.dealerId, id);
  }

  @Post(':id/set-default')
  @RequirePermissions({ module: MODULE, action: PermissionAction.EDIT })
  setDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentTemplatesService.setDefault(user.dealerId, id);
  }
}
