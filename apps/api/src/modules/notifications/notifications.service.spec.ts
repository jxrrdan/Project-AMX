import { NotificationChannel } from '@project-amx/shared';
import { NotificationsService } from './notifications.service';

function makeDeps(overrides: Record<string, unknown> = {}) {
  const prisma = {
    notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'user@example.com', phone: '+447700900000' }) },
  };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const sms = { send: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = { send: jest.fn().mockResolvedValue(undefined) };
  return { prisma: { ...prisma, ...overrides }, email, sms, whatsapp };
}

describe('NotificationsService.create', () => {
  it('always writes an IN_APP row regardless of the requested delivery channel', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'STALE_LEAD', 'Stale lead', 'No activity in 7 days', NotificationChannel.EMAIL);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        dealerId: 'dealer-1',
        userId: 'user-1',
        channel: NotificationChannel.IN_APP,
        eventType: 'STALE_LEAD',
        title: 'Stale lead',
        body: 'No activity in 7 days',
      },
    });
  });

  it('IN_APP channel (the default) does not call email or SMS', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'EVT', 'title', 'body');

    expect(email.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('EMAIL channel sends via EmailService using the user\'s email address', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'EVT', 'Stale lead', 'body text', NotificationChannel.EMAIL);

    expect(email.send).toHaveBeenCalledWith({ to: 'user@example.com', subject: 'Stale lead', html: '<p>body text</p>' });
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('SMS channel sends via SmsService using the user\'s phone number', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'EVT', 'Stale lead', 'body text', NotificationChannel.SMS);

    expect(sms.send).toHaveBeenCalledWith('+447700900000', 'Stale lead: body text');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('SMS channel is skipped (no throw) when the user has no phone number on file', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps({ user: { findUnique: jest.fn().mockResolvedValue({ email: 'x@example.com', phone: null }) } });
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'EVT', 'title', 'body', NotificationChannel.SMS);

    expect(sms.send).not.toHaveBeenCalled();
  });

  it('WHATSAPP channel sends via WhatsAppService using the user\'s phone number', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'EVT', 'Stale lead', 'body text', NotificationChannel.WHATSAPP);

    expect(whatsapp.send).toHaveBeenCalledWith('+447700900000', 'Stale lead: body text');
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('WHATSAPP channel is skipped (no throw) when the user has no phone number on file', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps({ user: { findUnique: jest.fn().mockResolvedValue({ email: 'x@example.com', phone: null }) } });
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.create('dealer-1', 'user-1', 'EVT', 'title', 'body', NotificationChannel.WHATSAPP);

    expect(whatsapp.send).not.toHaveBeenCalled();
  });

  it('PUSH channel logs a warning rather than throwing — no push adapter exists yet', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await expect(service.create('dealer-1', 'user-1', 'EVT', 'title', 'body', NotificationChannel.PUSH)).resolves.toBeDefined();
    expect(email.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.createMany', () => {
  it('is a no-op for an empty user list', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    const result = await service.createMany('dealer-1', [], 'EVT', 'title', 'body');

    expect(result).toEqual({ count: 0 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('delivers to every user id when a real channel is requested', async () => {
    const { prisma, email, sms, whatsapp } = makeDeps();
    const service = new NotificationsService(prisma as never, email as never, sms as never, whatsapp as never);

    await service.createMany('dealer-1', ['u1', 'u2'], 'EVT', 'title', 'body', NotificationChannel.EMAIL);

    expect(email.send).toHaveBeenCalledTimes(2);
  });
});
