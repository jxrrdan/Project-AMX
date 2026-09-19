import { NotFoundException } from '@nestjs/common';
import { CrmService } from './crm.service';

describe('CrmService.createActivity', () => {
  const dealerId = 'dealer-1';

  it('refuses to attach an activity to another dealer\'s contact', async () => {
    const create = jest.fn();
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue(null) },
      crmActivity: { create },
    };
    const service = new CrmService(prisma as never);
    await expect(
      service.createActivity(dealerId, { contactId: 'other-dealer-contact', type: 'NOTE' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses to attach an activity to another dealer\'s lead', async () => {
    const create = jest.fn();
    const prisma = {
      lead: { findFirst: jest.fn().mockResolvedValue(null) },
      crmActivity: { create },
    };
    const service = new CrmService(prisma as never);
    await expect(
      service.createActivity(dealerId, { leadId: 'other-dealer-lead', type: 'NOTE' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the activity once ownership of the referenced contact/lead is confirmed', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'activity-1' });
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'contact-1' }) },
      crmActivity: { create },
    };
    const service = new CrmService(prisma as never);
    await service.createActivity(dealerId, { contactId: 'contact-1', type: 'NOTE' } as never);
    expect(create).toHaveBeenCalled();
  });
});

describe('CrmService.createTask', () => {
  const dealerId = 'dealer-1';

  it('refuses to create a task against another dealer\'s contact', async () => {
    const create = jest.fn();
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue(null) },
      crmTask: { create },
    };
    const service = new CrmService(prisma as never);
    await expect(
      service.createTask(dealerId, {
        contactId: 'other-dealer-contact',
        assigneeId: 'user-1',
        title: 'Follow up',
        dueDate: '2026-01-01',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('CrmService.completeTask', () => {
  const dealerId = 'dealer-1';

  it('refuses to complete a task belonging to another dealer', async () => {
    const update = jest.fn();
    const prisma = {
      crmTask: { findFirst: jest.fn().mockResolvedValue(null), update },
    };
    const service = new CrmService(prisma as never);
    await expect(service.completeTask(dealerId, 'other-dealer-task')).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('completes the task once ownership is confirmed via its contact or lead', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'task-1', completedAt: new Date() });
    const prisma = {
      crmTask: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1' }), update },
    };
    const service = new CrmService(prisma as never);
    await service.completeTask(dealerId, 'task-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1' }, data: { completedAt: expect.any(Date) } }),
    );
  });
});
