import { NotFoundException } from '@nestjs/common';
import {
  LeadStage,
  WorkflowActionType,
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowEnrollmentStatus,
} from '@project-amx/shared';
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

describe('WorkflowsService.processDueSteps — condition/branch step', () => {
  function makeCondition(overrides: Record<string, unknown> = {}) {
    return {
      field: WorkflowConditionField.LEAD_STAGE,
      operator: WorkflowConditionOperator.EQUALS,
      value: LeadStage.ENQUIRY,
      onTrueStep: 10,
      onFalseStep: 20,
      ...overrides,
    };
  }

  function makeEnrollment(overrides: Record<string, unknown> = {}) {
    return {
      id: 'enrollment-1',
      currentStep: 0,
      contact: null,
      lead: { stage: LeadStage.ENQUIRY },
      leadId: 'lead-1',
      workflow: {
        steps: [
          { sortOrder: 0, delayHours: 0, actionType: WorkflowActionType.CONDITION, actionConfig: makeCondition() },
          { sortOrder: 10, delayHours: 1, actionType: WorkflowActionType.SEND_EMAIL, actionConfig: { subject: 'Still interested?' } },
          { sortOrder: 20, delayHours: 1, actionType: WorkflowActionType.SEND_EMAIL, actionConfig: { subject: 'Sorry to see you go' } },
        ],
      },
      ...overrides,
    };
  }

  it('jumps to onTrueStep when the condition matches, and schedules that step\'s own delay', async () => {
    const update = jest.fn();
    const prisma = {
      workflowEnrollment: { findMany: jest.fn().mockResolvedValue([makeEnrollment()]), update },
    };
    const service = makeService(prisma);
    await service.processDueSteps();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enrollment-1' },
        data: expect.objectContaining({ currentStep: 10, status: WorkflowEnrollmentStatus.ACTIVE }),
      }),
    );
  });

  it('jumps to onFalseStep when the condition does not match', async () => {
    const update = jest.fn();
    const prisma = {
      workflowEnrollment: {
        findMany: jest.fn().mockResolvedValue([makeEnrollment({ lead: { stage: LeadStage.SOLD } })]),
        update,
      },
    };
    const service = makeService(prisma);
    await service.processDueSteps();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStep: 20, status: WorkflowEnrollmentStatus.ACTIVE }) }),
    );
  });

  it('completes the enrolment when a branch target step does not exist', async () => {
    const update = jest.fn();
    const prisma = {
      workflowEnrollment: {
        findMany: jest.fn().mockResolvedValue([
          makeEnrollment({
            workflow: {
              steps: [
                {
                  sortOrder: 0,
                  delayHours: 0,
                  actionType: WorkflowActionType.CONDITION,
                  actionConfig: makeCondition({ onTrueStep: 999 }),
                },
              ],
            },
          }),
        ]),
        update,
      },
    };
    const service = makeService(prisma);
    await service.processDueSteps();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: WorkflowEnrollmentStatus.COMPLETED, currentStep: 999, nextRunAt: null } }),
    );
  });

  it('never treats a CONDITION step as a contact-facing action (no email/SMS/task side effect)', async () => {
    const email = { send: jest.fn() };
    const prisma = {
      workflowEnrollment: {
        findMany: jest.fn().mockResolvedValue([makeEnrollment({ contact: { email: 'a@b.com', firstName: 'A' } })]),
        update: jest.fn(),
      },
    };
    const service = new WorkflowsService(prisma as never, email as never, {} as never);
    await service.processDueSteps();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('still advances sequentially by sortOrder for a non-condition step', async () => {
    const update = jest.fn();
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      workflowEnrollment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enrollment-2',
            currentStep: 10,
            contact: { email: 'a@b.com', firstName: 'Alex' },
            lead: null,
            leadId: null,
            workflow: {
              steps: [
                { sortOrder: 0, delayHours: 0, actionType: WorkflowActionType.CONDITION, actionConfig: makeCondition() },
                { sortOrder: 10, delayHours: 1, actionType: WorkflowActionType.SEND_EMAIL, actionConfig: {} },
                { sortOrder: 20, delayHours: 3, actionType: WorkflowActionType.SEND_EMAIL, actionConfig: {} },
              ],
            },
          },
        ]),
        update,
      },
    };
    const service = new WorkflowsService(prisma as never, email as never, {} as never);
    await service.processDueSteps();

    expect(email.send).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStep: 20, status: WorkflowEnrollmentStatus.ACTIVE }) }),
    );
  });
});
