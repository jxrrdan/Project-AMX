import { Type } from 'class-transformer';
import { NominalAccountType, VatCode } from '@project-amx/shared';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class PostJournalLineDto {
  @IsString()
  accountCode!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsEnum(VatCode)
  vatCode?: VatCode;

  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

/** A manual journal — every automatic posting from another module goes through
 * LedgerService.post() directly rather than this DTO, which exists for the rare hand-adjustment. */
export class PostJournalDto {
  @IsString()
  reference!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostJournalLineDto)
  lines!: PostJournalLineDto[];
}

export class CreateNominalAccountDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(NominalAccountType)
  type!: NominalAccountType;

  @IsOptional()
  @IsEnum(VatCode)
  defaultVatCode?: VatCode;
}

export class VatReturnPeriodDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
