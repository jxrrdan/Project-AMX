import { UsedVehicleStatus, VehicleSource } from '@project-amx/shared';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

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

export class DealAccessoryLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}

/** A customer's incoming trade-in vehicle, captured in one step alongside the sale that generated
 * it — see TradeInService. Used identically for a used-car deal sheet or a new-car sale. */
export class TradeInDto {
  @IsString()
  reg!: string;

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
  condition?: string;

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

  /** Itemised dealer accessories (Feature Spec §4.5) — e.g. mudflaps, tow bar. Total is computed server-side. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DealAccessoryLineDto)
  accessories?: DealAccessoryLineDto[];

  /** If set, intakes this vehicle as new used stock (source: PART_EX) and its agreedValue becomes
   * this deal sheet's partExchangeValue, taking priority over a separately-supplied one. */
  @IsOptional()
  @ValidateNested()
  @Type(() => TradeInDto)
  tradeIn?: TradeInDto;
}

export class InvalidateDealSheetDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
