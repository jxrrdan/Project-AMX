import { FiProductType } from '@project-amx/shared';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFinanceProductDto {
  @IsEnum(FiProductType)
  type!: FiProductType;

  @IsString()
  name!: string;

  @IsString()
  providerName!: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  commissionFixed?: number;

  @IsOptional()
  @IsString()
  fcaProductRef?: string;
}

export class AddDealProductDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  usedVehicleId?: string;

  @IsString()
  productId!: string;

  @IsOptional()
  @IsNumber()
  term?: number;

  @IsOptional()
  @IsNumber()
  monthlyPayment?: number;

  @IsOptional()
  @IsNumber()
  totalPremium?: number;

  @IsOptional()
  @IsString()
  lenderName?: string;

  @IsOptional()
  @IsString()
  agreementNumber?: string;

  @IsOptional()
  @IsNumber()
  amountFinanced?: number;

  @IsOptional()
  @IsNumber()
  apr?: number;
}

export class RecordDisclosureDto {
  @IsBoolean()
  commissionDisclosed!: boolean;

  @IsString()
  customerSignatureUrl!: string;

  @IsOptional()
  @IsBoolean()
  vulnerableCustomerFlag?: boolean;
}
