import { Controller, Get, Param, Patch } from '@nestjs/common';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

/** In-app notification centre — Feature Spec §7.7. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.prisma.notification.findMany({
      where: { dealerId: user.dealerId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
  }
}
