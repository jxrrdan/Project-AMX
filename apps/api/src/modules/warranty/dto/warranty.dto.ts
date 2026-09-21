import { WarrantyClaimStatus } from '@project-amx/shared';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateWarrantyClaimDto {
  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  jobCardId?: string;

  @IsString()
  customerName!: string;

  @IsString()
  faultDescription!: string;

  @IsOptional()
  @IsString()
  symptomCode?: string;
}

export class CreateOperationLineDto {
  @IsString()
  operationCode!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(0)
  standardMinutes!: number;
}

export class UpdateOperationLineDto {
  @IsOptional()
  @IsString()
  cause?: string;

  @IsOptional()
  @IsString()
  correction?: string;

  @IsOptional()
  @IsString()
  complaint?: string;

  @IsOptional()
  @IsString()
  labourWriteUp?: string;
}

export class UpdateClaimStatusDto {
  @IsEnum(WarrantyClaimStatus)
  status!: WarrantyClaimStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsNumber()
  actualPayment?: number;
}
