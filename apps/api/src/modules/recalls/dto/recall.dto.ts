import { RecallCampaignStatus, RecallVehicleStatus } from '@project-amx/shared';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateRecallCampaignDto {
  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  affectedModels?: string;

  @IsOptional()
  @IsDateString()
  launchedAt?: string;
}

export class UpdateRecallCampaignDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  affectedModels?: string;

  @IsOptional()
  @IsEnum(RecallCampaignStatus)
  status?: RecallCampaignStatus;

  @IsOptional()
  @IsDateString()
  launchedAt?: string;
}

export class AddRecallVehicleDto {
  @IsString()
  vin!: string;

  @IsOptional()
  @IsString()
  registration?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerContact?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRecallVehicleDto {
  @IsOptional()
  @IsEnum(RecallVehicleStatus)
  status?: RecallVehicleStatus;

  @IsOptional()
  @IsDateString()
  bookedDate?: string;

  @IsOptional()
  @IsString()
  customerContact?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
