import { AccountingProvider, AccountingTxnType } from '@project-amx/shared';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateIntegrationDto {
  @IsEnum(AccountingProvider)
  provider!: AccountingProvider;

  @IsOptional()
  @IsObject()
  accountMappings?: Record<string, string>;
}

export class CreateTransactionDto {
  @IsString()
  integrationId!: string;

  @IsEnum(AccountingTxnType)
  type!: AccountingTxnType;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  nominalCode?: string;

  @IsOptional()
  @IsString()
  sourceRecordId?: string;
}
