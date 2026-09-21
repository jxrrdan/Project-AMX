import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateCustomerInvoiceDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}
