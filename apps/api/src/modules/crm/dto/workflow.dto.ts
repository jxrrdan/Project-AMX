import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { WorkflowActionType, WorkflowTrigger } from '@project-amx/shared';

export class CreateWorkflowStepDto {
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsInt()
  @Min(0)
  delayHours!: number;

  @IsEnum(WorkflowActionType)
  actionType!: WorkflowActionType;

  @IsObject()
  actionConfig!: Record<string, unknown>;
}

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(WorkflowTrigger)
  trigger?: WorkflowTrigger;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps!: CreateWorkflowStepDto[];
}

export class EnrollDto {
  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;
}
