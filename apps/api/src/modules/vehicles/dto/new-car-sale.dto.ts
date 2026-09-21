import { SaleModel } from '@project-amx/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { TradeInDto } from '../../used-cars/dto/used-car.dto';

export class CreateNewCarSaleDto {
  @IsEnum(SaleModel)
  saleModel!: SaleModel;

  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  /** Only meaningful when saleModel = AGENCY — the fee the OEM pays the dealer for facilitating this sale. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  agencyCommission?: number;

  /** If set, intakes this vehicle as new used stock and its agreedValue becomes this sale's partExchangeValue. */
  @IsOptional()
  @ValidateNested()
  @Type(() => TradeInDto)
  tradeIn?: TradeInDto;
}

export class InvalidateNewCarSaleDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
