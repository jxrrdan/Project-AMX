import { CrmActivityType, LeadSource, LeadStage } from '@project-amx/shared';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateContactDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  gdprConsent?: boolean;
}

export class CreateLeadDto {
  @IsString()
  contactId!: string;

  @IsOptional()
  @IsString()
  usedVehicleId?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  assignedSalespersonId?: string;
}

export class UpdateLeadStageDto {
  @IsEnum(LeadStage)
  stage!: LeadStage;

  @IsOptional()
  @IsString()
  lostReason?: string;
}

export class CreateActivityDto {
  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsEnum(CrmActivityType)
  type!: CrmActivityType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsString()
  assigneeId!: string;

  @IsString()
  title!: string;

  @IsString()
  dueDate!: string;
}
