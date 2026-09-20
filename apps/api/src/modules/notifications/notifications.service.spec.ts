import { NotificationChannel } from '@project-amx/shared';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('create writes an IN_APP notification for the given dealer/user', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'n1' });
    const service = new NotificationsService({ notification: { create } } as never);

    await service.create('dealer-1', 'user-1', 'STALE_LEAD', 'Stale lead', 'No activity in 7 days');

    expect(create).toHaveBeenCalledWith({
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

  it('createMany is a no-op for an empty user list', async () => {
    const createMany = jest.fn();
    const service = new NotificationsService({ notification: { createMany } } as never);

    const result = await service.createMany('dealer-1', [], 'EVT', 'title', 'body');

    expect(result).toEqual({ count: 0 });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('createMany fans out one row per user id', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new NotificationsService({ notification: { createMany } } as never);

    await service.createMany('dealer-1', ['u1', 'u2'], 'EVT', 'title', 'body');

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { dealerId: 'dealer-1', userId: 'u1', channel: NotificationChannel.IN_APP, eventType: 'EVT', title: 'title', body: 'body' },
        { dealerId: 'dealer-1', userId: 'u2', channel: NotificationChannel.IN_APP, eventType: 'EVT', title: 'title', body: 'body' },
      ],
    });
  });
});
