import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { LeadStage, WorkflowActionType, WorkflowEnrollmentStatus } from '@project-amx/shared';
import { addHours } from 'date-fns';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from '../../common/sms/sms.service';
import { CreateWorkflowDto, EnrollDto } from './dto/workflow.dto';

/**
 * Module 8.9 — nurture workflow builder and runner. Each step fires after `delayHours` from
 * enrolment/the previous step; a cron tick advances any enrolment whose `nextRunAt` has passed.
 * This is a simplified sequential runner (no branching/condition steps yet) — enough to
 * demonstrate the pre-built nurture sequences end-to-end; a production build would add the
 * condition/branch step type described in the spec's workflow builder.
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

  async enroll(workflowId: string, dto: EnrollDto) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId }, include: { steps: true } });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
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
      const step = steps[enrollment.currentStep];
      if (!step) {
        await this.prisma.workflowEnrollment.update({
          where: { id: enrollment.id },
          data: { status: WorkflowEnrollmentStatus.COMPLETED, nextRunAt: null },
        });
        continue;
      }

      const contact = enrollment.contact ?? enrollment.lead?.contact ?? null;
      await this.executeStep(
        step.actionType as unknown as WorkflowActionType,
        step.actionConfig as Record<string, unknown>,
        contact,
        enrollment.leadId,
      );

      const nextStep = steps[enrollment.currentStep + 1];
      await this.prisma.workflowEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: enrollment.currentStep + 1,
          nextRunAt: nextStep ? addHours(new Date(), nextStep.delayHours) : null,
          status: nextStep ? WorkflowEnrollmentStatus.ACTIVE : WorkflowEnrollmentStatus.COMPLETED,
        },
      });
    }
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
