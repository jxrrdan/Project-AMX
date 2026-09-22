import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ManufacturerPaymentBatchLineDto {
  @IsOptional()
  @IsString()
  warrantyClaimId?: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

/** One manufacturer remittance run — the OEM's self-billing document covering many warranty
 * claims (or parts rebates) paid in a single batch (§ bulk manufacturer/warranty payment processing). */
export class CreateManufacturerPaymentBatchDto {
  @IsString()
  supplierId!: string;

  @IsString()
  batchReference!: string;

  @IsOptional()
  @IsBoolean()
  isSelfBill?: boolean;

  @IsOptional()
  @IsString()
  remittanceUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManufacturerPaymentBatchLineDto)
  lines!: ManufacturerPaymentBatchLineDto[];
}
