import { Controller, Get, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Read side of Feature Spec §7.5 — filterable, exportable, immutable audit trail. Writes happen via AuditService.record(). */
@Controller('audit-log')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.ADMIN, action: PermissionAction.VIEW })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
    @Query('module') module?: ModuleKey,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        dealerId: user.dealerId,
        userId: userId || undefined,
        module: module || undefined,
        createdAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
