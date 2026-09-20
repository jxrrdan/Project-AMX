import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DealersService } from './dealers.service';
import { DocumentSequenceService } from './document-sequence.service';
import { SetModuleLicenseDto, UpdateDealerDto, UpdateDocumentSequenceDto, UploadLogoDto } from './dto/dealer.dto';

@Controller('dealers/me')
export class DealersController {
  constructor(
    private readonly dealersService: DealersService,
    private readonly documentSequenceService: DocumentSequenceService,
  ) {}

  @Get()
  findOne(@CurrentUser() user: AuthUser) {
    return this.dealersService.findOne(user.dealerId);
  }

  @Patch()
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateDealerDto) {
    return this.dealersService.update(user.dealerId, dto);
  }

  @Post('module-licenses')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  setModuleLicense(@CurrentUser() user: AuthUser, @Body() dto: SetModuleLicenseDto) {
    return this.dealersService.setModuleLicense(user.dealerId, dto);
  }

  /** Revokes the current workshop TV board link (e.g. if it was shared inappropriately) and issues a new one. */
  @Post('workshop-board-token/regenerate')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  regenerateBoardToken(@CurrentUser() user: AuthUser) {
    return this.dealersService.regenerateBoardToken(user.dealerId);
  }

  @Post('logo')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  uploadLogo(@CurrentUser() user: AuthUser, @Body() dto: UploadLogoDto) {
    return this.dealersService.uploadLogo(user.dealerId, dto.dataUrl);
  }

  @Get('document-sequences')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.VIEW })
  listDocumentSequences(@CurrentUser() user: AuthUser) {
    return this.documentSequenceService.list(user.dealerId);
  }

  @Patch('document-sequences/:id')
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.EDIT })
  updateDocumentSequence(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDocumentSequenceDto) {
    return this.documentSequenceService.update(user.dealerId, id, dto);
  }
}
