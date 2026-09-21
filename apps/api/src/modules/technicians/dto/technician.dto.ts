import { JobCategory, TechnicianAvailabilityStatus } from '@project-amx/shared';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetTechnicianSkillsDto {
  @IsArray()
  @IsEnum(JobCategory, { each: true })
  categories!: JobCategory[];
}

export class SetTechnicianAvailabilityDto {
  @IsString()
  userId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(TechnicianAvailabilityStatus)
  status!: TechnicianAvailabilityStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  availableMinutes?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
