import { StockMovementType } from '@project-amx/shared';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartDto {
  @IsString()
  partNumber!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  binLocation?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;
}

export class CreateStockMovementDto {
  @IsString()
  partId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class AllocatePartDto {
  @IsString()
  partId!: string;

  @IsString()
  jobCardId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;
}
