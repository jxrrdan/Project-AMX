import { NotFoundException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';

function makeService(prisma: Record<string, unknown>) {
  return new WorkflowsService(prisma as never, {} as never, {} as never);
}

describe('WorkflowsService.enroll', () => {
  const dealerId = 'dealer-1';

  it('refuses to enroll into another dealer\'s workflow', async () => {
    const create = jest.fn();
    const prisma = {
      workflow: { findFirst: jest.fn().mockResolvedValue(null) },
      workflowEnrollment: { create },
    };
    const service = makeService(prisma);
    await expect(service.enroll(dealerId, 'other-dealer-workflow', { contactId: 'contact-1' } as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses to enroll a contact belonging to another dealer', async () => {
    const create = jest.fn();
    const prisma = {
      workflow: { findFirst: jest.fn().mockResolvedValue({ id: 'workflow-1', steps: [] }) },
      contact: { findFirst: jest.fn().mockResolvedValue(null) },
      workflowEnrollment: { create },
    };
    const service = makeService(prisma);
    await expect(
      service.enroll(dealerId, 'workflow-1', { contactId: 'other-dealer-contact' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses to enroll a lead belonging to another dealer', async () => {
    const create = jest.fn();
    const prisma = {
      workflow: { findFirst: jest.fn().mockResolvedValue({ id: 'workflow-1', steps: [] }) },
      lead: { findFirst: jest.fn().mockResolvedValue(null) },
      workflowEnrollment: { create },
    };
    const service = makeService(prisma);
    await expect(service.enroll(dealerId, 'workflow-1', { leadId: 'other-dealer-lead' } as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('enrolls once the workflow and target contact both belong to this dealer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'enrollment-1' });
    const prisma = {
      workflow: {
        findFirst: jest.fn().mockResolvedValue({ id: 'workflow-1', steps: [{ sortOrder: 0, delayHours: 2 }] }),
      },
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'contact-1' }) },
      workflowEnrollment: { create },
    };
    const service = makeService(prisma);
    await service.enroll(dealerId, 'workflow-1', { contactId: 'contact-1' } as never);
    expect(create).toHaveBeenCalled();
  });
});
