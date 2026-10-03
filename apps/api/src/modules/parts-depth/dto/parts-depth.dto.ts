import { BackorderStatus } from '@project-amx/shared';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  accountRef?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  accountRef?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AddPriceItemDto {
  @IsString()
  partNumber!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  costPrice!: number;
}

export class CreateStockCountDto {
  @IsString()
  reference!: string;
}

export class UpdateStockCountLineDto {
  @IsInt()
  @Min(0)
  countedQty!: number;
}

export class CreateBackorderDto {
  @IsString()
  partId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class UpdateBackorderDto {
  @IsOptional()
  @IsEnum(BackorderStatus)
  status?: BackorderStatus;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;
}
