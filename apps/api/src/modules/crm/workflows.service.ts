import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import {
  LeadStage,
  WorkflowActionType,
  WorkflowConditionConfig,
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowEnrollmentStatus,
} from '@project-amx/shared';
import { addHours } from 'date-fns';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from '../../common/sms/sms.service';
import { CreateWorkflowDto, EnrollDto } from './dto/workflow.dto';

/**
 * Module 8.9 — nurture workflow builder and runner. Each step fires after `delayHours` from
 * enrolment/the previous step; a cron tick advances any enrolment whose `nextRunAt` has passed.
 * `currentStep` holds a step's `sortOrder` (not an array index), which is what lets a CONDITION
 * step jump to any other step rather than always advancing by one.
 */
@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  listWorkflows(dealerId: string) {
    return this.prisma.workflow.findMany({ where: { dealerId }, include: { steps: true } });
  }

  createWorkflow(dealerId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        dealerId,
        name: dto.name,
        trigger: dto.trigger,
        steps: {
          create: dto.steps.map((step) => ({ ...step, actionConfig: step.actionConfig as Prisma.InputJsonValue })),
        },
      },
      include: { steps: true },
    });
  }

  async enroll(dealerId: string, workflowId: string, dto: EnrollDto) {
    const workflow = await this.prisma.workflow.findFirst({ where: { id: workflowId, dealerId }, include: { steps: true } });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, dealerId } });
      if (!contact) {
        throw new NotFoundException('Contact not found');
      }
    }
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, dealerId } });
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
    }
    const firstStep = workflow.steps.sort((a, b) => a.sortOrder - b.sortOrder)[0];

    return this.prisma.workflowEnrollment.create({
      data: {
        workflowId,
        contactId: dto.contactId,
        leadId: dto.leadId,
        nextRunAt: firstStep ? addHours(new Date(), firstStep.delayHours) : null,
      },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processDueSteps() {
    const due = await this.prisma.workflowEnrollment.findMany({
      where: { status: WorkflowEnrollmentStatus.ACTIVE, nextRunAt: { lte: new Date() } },
      include: { workflow: { include: { steps: true } }, contact: true, lead: { include: { contact: true } } },
    });

    for (const enrollment of due) {
      const steps = enrollment.workflow.steps.sort((a, b) => a.sortOrder - b.sortOrder);
      const stepIndex = steps.findIndex((s) => s.sortOrder === enrollment.currentStep);
      const step = stepIndex === -1 ? undefined : steps[stepIndex];
      if (!step) {
        await this.prisma.workflowEnrollment.update({
          where: { id: enrollment.id },
          data: { status: WorkflowEnrollmentStatus.COMPLETED, nextRunAt: null },
        });
        continue;
      }

      const contact = enrollment.contact ?? enrollment.lead?.contact ?? null;

      if ((step.actionType as unknown as WorkflowActionType) === WorkflowActionType.CONDITION) {
        const config = step.actionConfig as unknown as WorkflowConditionConfig;
        const matched = this.evaluateCondition(
          config,
          contact,
          enrollment.lead as unknown as { stage: LeadStage } | null,
        );
        const targetSortOrder = matched ? config.onTrueStep : config.onFalseStep;
        const targetStep = steps.find((s) => s.sortOrder === targetSortOrder);
        await this.prisma.workflowEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: targetSortOrder,
            nextRunAt: targetStep ? addHours(new Date(), targetStep.delayHours) : null,
            status: targetStep ? WorkflowEnrollmentStatus.ACTIVE : WorkflowEnrollmentStatus.COMPLETED,
          },
        });
        continue;
      }

      await this.executeStep(
        step.actionType as unknown as WorkflowActionType,
        step.actionConfig as Record<string, unknown>,
        contact,
        enrollment.leadId,
      );

      const nextStep = steps[stepIndex + 1];
      await this.prisma.workflowEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: nextStep ? nextStep.sortOrder : enrollment.currentStep,
          nextRunAt: nextStep ? addHours(new Date(), nextStep.delayHours) : null,
          status: nextStep ? WorkflowEnrollmentStatus.ACTIVE : WorkflowEnrollmentStatus.COMPLETED,
        },
      });
    }
  }

  /** Evaluates a CONDITION step's branch against the enrolment's contact/lead. */
  private evaluateCondition(
    config: WorkflowConditionConfig,
    contact: { email: string | null; phone: string | null; gdprConsent: boolean } | null,
    lead: { stage: LeadStage } | null,
  ): boolean {
    const actual = ((): string => {
      switch (config.field) {
        case WorkflowConditionField.LEAD_STAGE:
          return lead?.stage ?? '';
        case WorkflowConditionField.CONTACT_HAS_EMAIL:
          return contact?.email ? 'true' : 'false';
        case WorkflowConditionField.CONTACT_HAS_PHONE:
          return contact?.phone ? 'true' : 'false';
        case WorkflowConditionField.CONTACT_GDPR_CONSENT:
          return contact?.gdprConsent ? 'true' : 'false';
        default:
          return '';
      }
    })();

    const matches = actual === config.value;
    return config.operator === WorkflowConditionOperator.NOT_EQUALS ? !matches : matches;
  }

  private async executeStep(
    actionType: WorkflowActionType,
    config: Record<string, unknown>,
    contact: { id: string; firstName: string; email: string | null; phone: string | null } | null,
    leadId: string | null,
  ) {
    if (!contact) return;

    switch (actionType) {
      case WorkflowActionType.SEND_EMAIL:
        if (contact.email) {
          await this.email.send({
            to: contact.email,
            subject: String(config['subject'] ?? 'Update from your dealer'),
            html: String(config['body'] ?? `Hi ${contact.firstName},`),
          });
        }
        break;
      case WorkflowActionType.SEND_SMS:
        if (contact.phone) {
          await this.sms.send(contact.phone, String(config['body'] ?? `Hi ${contact.firstName}`));
        }
        break;
      case WorkflowActionType.CREATE_TASK:
        await this.prisma.crmTask.create({
          data: {
            contactId: contact.id,
            leadId: leadId ?? undefined,
            assigneeId: String(config['assigneeId']),
            title: String(config['title'] ?? 'Follow up'),
            dueDate: new Date(),
          },
        });
        break;
      case WorkflowActionType.CHANGE_LEAD_STAGE:
        if (leadId) {
          await this.prisma.lead.update({ where: { id: leadId }, data: { stage: config['stage'] as LeadStage } });
        }
        break;
      default:
        this.logger.warn(`Unhandled workflow action type: ${actionType}`);
    }
  }
}
