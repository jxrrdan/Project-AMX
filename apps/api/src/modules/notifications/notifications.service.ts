import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@project-amx/shared';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from '../../common/sms/sms.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';

/**
 * Write side of the in-app notification centre (see NotificationsController for the read side).
 * Every notification always gets an IN_APP row (so the bell always has a record of it), and the
 * caller additionally picks a delivery channel:
 *   - EMAIL: also sent via EmailService (console-log locally, real SES in production).
 *   - SMS: also sent via SmsService (console-log locally, real SNS/Twilio in production) — skipped
 *     with a warning if the user has no phone number on file.
 *   - WHATSAPP: also sent via WhatsAppService (console-log locally, real WhatsApp Business API in
 *     production) — same phone-number requirement and skip behaviour as SMS.
 *   - PUSH: not implemented — there's no push adapter (FCM/APNs/web-push) anywhere in this app
 *     yet, so this logs a warning rather than pretending to deliver.
 *   - IN_APP: no extra delivery, the DB row is the whole notification.
 * Used by scheduled maintenance jobs (BatchJobsService) and anything else that needs to surface
 * something to a user without them having to be looking at the right screen at the right time.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async create(
    dealerId: string,
    userId: string,
    eventType: string,
    title: string,
    body: string,
    channel: NotificationChannel = NotificationChannel.IN_APP,
  ) {
    const notification = await this.prisma.notification.create({
      data: { dealerId, userId, channel: NotificationChannel.IN_APP, eventType, title, body },
    });
    await this.deliver(userId, title, body, channel);
    return notification;
  }

  async createMany(
    dealerId: string,
    userIds: string[],
    eventType: string,
    title: string,
    body: string,
    channel: NotificationChannel = NotificationChannel.IN_APP,
  ) {
    if (!userIds.length) return { count: 0 };
    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ dealerId, userId, channel: NotificationChannel.IN_APP, eventType, title, body })),
    });
    await Promise.all(userIds.map((userId) => this.deliver(userId, title, body, channel)));
    return result;
  }

  private async deliver(userId: string, title: string, body: string, channel: NotificationChannel): Promise<void> {
    if (channel === NotificationChannel.IN_APP) return;

    if (channel === NotificationChannel.PUSH) {
      this.logger.warn(`PUSH notification requested for user ${userId} but no push adapter is configured — skipping`);
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
    if (!user) return;

    if (channel === NotificationChannel.EMAIL) {
      await this.email.send({ to: user.email, subject: title, html: `<p>${body}</p>` });
      return;
    }

    if (channel === NotificationChannel.SMS) {
      if (!user.phone) {
        this.logger.warn(`SMS notification requested for user ${userId} but they have no phone number on file — skipping`);
        return;
      }
      await this.sms.send(user.phone, `${title}: ${body}`);
      return;
    }

    if (channel === NotificationChannel.WHATSAPP) {
      if (!user.phone) {
        this.logger.warn(`WhatsApp notification requested for user ${userId} but they have no phone number on file — skipping`);
        return;
      }
      await this.whatsapp.send(user.phone, `${title}: ${body}`);
    }
  }
}
