import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeadStage, ModuleKey, PermissionAction } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CommunicationsService } from './communications.service';
import {
  CreateActivityDto,
  CreateContactDto,
  CreateEnquiryDto,
  CreateLeadDto,
  CreateTaskDto,
  UpdateLeadStageDto,
} from './dto/contact.dto';
import { CreateEmailTemplateDto, SendEmailDto, SendSmsDto } from './dto/template.dto';
import { CreateWorkflowDto, EnrollDto } from './dto/workflow.dto';
import { CrmService } from './crm.service';
import { WorkflowsService } from './workflows.service';

@Controller()
export class CrmController {
  constructor(
    private readonly crmService: CrmService,
    private readonly communicationsService: CommunicationsService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  @Get('contacts')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  listContacts(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.crmService.listContacts(user.dealerId, search);
  }

  @Get('contacts/:id')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  findContact(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crmService.findContact(user.dealerId, id);
  }

  @Post('contacts')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  createContact(@CurrentUser() user: AuthUser, @Body() dto: CreateContactDto) {
    return this.crmService.createContact(user.dealerId, dto);
  }

  /**
   * Public embeddable enquiry form endpoint (Feature Spec §8.1) — the dealer website posts here
   * directly, no auth. Mirrors the pattern already used for the service-booking widget
   * (Module 2.5) and the customer chatbot (Module 15).
   */
  @Public()
  @Post('dealers/:dealerId/enquiries')
  createEnquiry(@Param('dealerId') dealerId: string, @Body() dto: CreateEnquiryDto) {
    return this.crmService.createEnquiry(dealerId, dto);
  }

  @Get('leads')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  listLeads(@CurrentUser() user: AuthUser, @Query('stage') stage?: LeadStage, @Query('salespersonId') salespersonId?: string) {
    return this.crmService.listLeads(user.dealerId, stage, salespersonId);
  }

  @Post('leads')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  createLead(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.crmService.createLead(user.dealerId, dto);
  }

  @Patch('leads/:id/stage')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.EDIT })
  updateStage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeadStageDto) {
    return this.crmService.updateStage(user.dealerId, id, dto);
  }

  @Get('reports/pipeline')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  pipelineReport(@CurrentUser() user: AuthUser) {
    return this.crmService.pipelineReport(user.dealerId);
  }

  @Post('crm-activities')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  createActivity(@CurrentUser() user: AuthUser, @Body() dto: CreateActivityDto) {
    return this.crmService.createActivity(user.dealerId, dto);
  }

  @Post('crm-tasks')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  createTask(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.crmService.createTask(user.dealerId, dto);
  }

  @Get('crm-tasks/overdue')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  overdueTasks(@CurrentUser() user: AuthUser) {
    return this.crmService.listOverdueTasks(user.dealerId);
  }

  @Patch('crm-tasks/:id/complete')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.EDIT })
  completeTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crmService.completeTask(user.dealerId, id);
  }

  @Get('email-templates')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.communicationsService.listTemplates(user.dealerId);
  }

  @Post('email-templates')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  createTemplate(@CurrentUser() user: AuthUser, @Body() dto: CreateEmailTemplateDto) {
    return this.communicationsService.createTemplate(user.dealerId, dto);
  }

  @Post('emails/send')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  sendEmail(@CurrentUser() user: AuthUser, @Body() dto: SendEmailDto) {
    return this.communicationsService.sendEmail(user.dealerId, dto);
  }

  @Post('sms/send')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  sendSms(@CurrentUser() user: AuthUser, @Body() dto: SendSmsDto) {
    return this.communicationsService.sendSms(user.dealerId, dto);
  }

  @Get('workflows')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.VIEW })
  listWorkflows(@CurrentUser() user: AuthUser) {
    return this.workflowsService.listWorkflows(user.dealerId);
  }

  @Post('workflows')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.CREATE })
  createWorkflow(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkflowDto) {
    return this.workflowsService.createWorkflow(user.dealerId, dto);
  }

  @Post('workflows/:id/enroll')
  @RequirePermissions({ module: ModuleKey.CRM, action: PermissionAction.EDIT })
  enroll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EnrollDto) {
    return this.workflowsService.enroll(user.dealerId, id, dto);
  }
}
