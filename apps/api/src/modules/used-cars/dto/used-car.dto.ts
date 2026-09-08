import { UsedVehicleStatus, VehicleSource } from '@project-amx/shared';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateUsedVehicleDto {
  @IsString()
  reg!: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsString()
  make!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsString()
  fuel?: string;

  @IsOptional()
  @IsString()
  transmission?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  askingPrice?: number;

  @IsOptional()
  @IsEnum(VehicleSource)
  source?: VehicleSource;
}

export class UpdateUsedVehicleStatusDto {
  @IsEnum(UsedVehicleStatus)
  status!: UsedVehicleStatus;
}

export class SetAskingPriceDto {
  @IsNumber()
  @Min(0)
  askingPrice!: number;
}

export class AddPhotosDto {
  @IsArray()
  @IsString({ each: true })
  urls!: string[];
}

export class CreateAppraisalDto {
  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsInt()
  mileage?: number;

  @IsOptional()
  @IsString()
  damageNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsNumber()
  @Min(0)
  agreedValue!: number;
}

export class CreateDealSheetDto {
  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @IsOptional()
  @IsNumber()
  partExchangeValue?: number;

  @IsOptional()
  @IsNumber()
  financeContribution?: number;

  @IsOptional()
  @IsNumber()
  accessoriesTotal?: number;
}
