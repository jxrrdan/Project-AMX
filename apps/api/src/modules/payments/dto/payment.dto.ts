import { PaymentMethod, PaymentSourceType } from '@project-amx/shared';
import { IsEnum } from 'class-validator';

/** Amount is deliberately not client-supplied — it's always read from the invoice itself
 * server-side, so a caller (especially the unauthenticated public pay page) can't submit an
 * arbitrary amount and have it accepted as a full payment. */
export class TakePaymentDto {
  @IsEnum(PaymentSourceType)
  sourceType!: PaymentSourceType;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
