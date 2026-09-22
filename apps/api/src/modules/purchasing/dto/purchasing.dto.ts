import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isManufacturer?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GoodsReceiptLineDto {
  @IsString()
  purchaseOrderLineId!: string;

  @IsInt()
  @Min(1)
  quantityReceived!: number;
}

export class CreateGoodsReceiptNoteDto {
  @IsString()
  purchaseOrderId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}

export class SupplierInvoiceLineDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  netAmount!: number;
}

export class CreateSupplierInvoiceDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  goodsReceiptNoteId?: string;

  @IsString()
  invoiceNumber!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsNumber()
  @Min(0)
  netAmount!: number;

  @IsNumber()
  @Min(0)
  vatAmount!: number;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  expenseAccountCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierInvoiceLineDto)
  lines?: SupplierInvoiceLineDto[];
}

/** Text extracted/pasted from a scanned or emailed supplier invoice, for the AI-extraction stub. */
export class ExtractInvoiceDto {
  @IsString()
  text!: string;
}
