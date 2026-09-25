import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsString, ValidateNested } from 'class-validator';

export class BankStatementLineInputDto {
  @IsDateString()
  date!: string;

  @IsString()
  description!: string;

  /** Positive = money in, negative = money out — as a bank statement itself represents it. */
  @IsNumber()
  amount!: number;
}

/** A mocked CSV/bank-feed import — no real Open Banking integration exists in this sandbox, so
 * the caller parses the CSV client-side (or pastes it) and posts the parsed rows here. */
export class ImportBankStatementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankStatementLineInputDto)
  lines!: BankStatementLineInputDto[];
}

export class MatchBankLineDto {
  @IsString()
  journalLineId!: string;
}
