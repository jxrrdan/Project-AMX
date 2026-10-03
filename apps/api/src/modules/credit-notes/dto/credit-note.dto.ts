import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreditNoteLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreateCreditNoteDto {
  @IsString()
  customerName!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  relatedInvoiceRef?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineDto)
  lines!: CreditNoteLineDto[];
}

export class UpdateCreditNoteDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  relatedInvoiceRef?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineDto)
  lines?: CreditNoteLineDto[];
}
