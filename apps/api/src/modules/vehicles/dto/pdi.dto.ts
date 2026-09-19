import { PdiItemRating } from '@project-amx/shared';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SchedulePdiDto {
  @IsDateString()
  scheduledDate!: string;

  @IsOptional()
  @IsString()
  bayId?: string;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;
}

export class UpdateChecklistItemDto {
  @IsEnum(PdiItemRating)
  rating!: PdiItemRating;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

export class SignOffPdiDto {
  @IsString()
  signedOffBy!: string;
}
