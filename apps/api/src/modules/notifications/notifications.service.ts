import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Write side of the in-app notification centre (see NotificationsController for the read side).
 * Used by scheduled maintenance jobs (BatchJobsService) and anything else that needs to surface
 * something to a user without them having to be looking at the right screen at the right time.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dealerId: string, userId: string, eventType: string, title: string, body: string) {
    return this.prisma.notification.create({
      data: { dealerId, userId, channel: NotificationChannel.IN_APP, eventType, title, body },
    });
  }

  createMany(dealerId: string, userIds: string[], eventType: string, title: string, body: string) {
    if (!userIds.length) return Promise.resolve({ count: 0 });
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ dealerId, userId, channel: NotificationChannel.IN_APP, eventType, title, body })),
    });
  }
}
