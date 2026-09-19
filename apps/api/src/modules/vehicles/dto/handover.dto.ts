import { HandoverType } from '@project-amx/shared';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateHandoverDto {
  @IsEnum(HandoverType)
  type!: HandoverType;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  usedVehicleId?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  advisorId?: string;
}

export class CompleteHandoverDto {
  @IsString()
  signatureUrl!: string;
}
