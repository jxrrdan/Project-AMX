import { JobCardStatus, JobType } from '@project-amx/shared';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateJobCardDto {
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  vehicleReg?: string;

  @IsEnum(JobType)
  jobType!: JobType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  bayId?: string;

  @IsOptional()
  @IsString()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsString()
  serviceAdvisorId?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;
}

export class UpdateJobCardDto {
  @IsOptional()
  @IsEnum(JobCardStatus)
  status?: JobCardStatus;

  @IsOptional()
  @IsString()
  bayId?: string;

  @IsOptional()
  @IsString()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBayDto {
  @IsString()
  name!: string;
}

export class SetCapacityDto {
  @IsString()
  bayId!: string;

  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0)
  availableMinutes!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
