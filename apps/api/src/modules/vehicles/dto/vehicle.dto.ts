import { VehiclePipelineStatus } from '@project-amx/shared';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  vin!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsDateString()
  eta?: string;

  @IsOptional()
  @IsString()
  allocatedAdvisorId?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsEnum(VehiclePipelineStatus)
  status?: VehiclePipelineStatus;

  @IsOptional()
  @IsDateString()
  eta?: string;

  @IsOptional()
  @IsString()
  allocatedAdvisorId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;
}
