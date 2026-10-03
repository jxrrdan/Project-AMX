import { Body, Controller, Get, Ip, Post, Query } from '@nestjs/common';
import { ConsentType, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateConsentDto, CreateSignatureDto } from './dto/compliance.dto';
import { ComplianceService } from './compliance.service';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Get('consents')
  @RequirePermissions({ module: ModuleKey.COMPLIANCE, action: PermissionAction.VIEW })
  listConsents(@CurrentUser() user: AuthUser, @Query('consentType') consentType?: ConsentType) {
    return this.service.listConsents(user.dealerId, consentType);
  }

  @Post('consents')
  @RequirePermissions({ module: ModuleKey.COMPLIANCE, action: PermissionAction.CREATE })
  createConsent(@CurrentUser() user: AuthUser, @Body() dto: CreateConsentDto) {
    return this.service.createConsent(user.dealerId, dto, `${user.firstName} ${user.lastName}`);
  }

  @Get('signatures')
  @RequirePermissions({ module: ModuleKey.COMPLIANCE, action: PermissionAction.VIEW })
  listSignatures(@CurrentUser() user: AuthUser) {
    return this.service.listSignatures(user.dealerId);
  }

  @Post('signatures')
  @RequirePermissions({ module: ModuleKey.COMPLIANCE, action: PermissionAction.CREATE })
  createSignature(@CurrentUser() user: AuthUser, @Body() dto: CreateSignatureDto, @Ip() ip: string) {
    return this.service.createSignature(user.dealerId, dto, ip);
  }
}
