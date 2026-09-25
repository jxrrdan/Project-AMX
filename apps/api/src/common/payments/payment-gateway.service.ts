import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@project-amx/shared';

export interface ChargeResult {
  success: boolean;
  providerRef?: string;
  failureReason?: string;
}

/**
 * Card/bank-transfer payment gateway abstraction. Production target is Stripe (or a UK-specific
 * processor like Bumper, which Pinewood.AI integrates with for exactly this); PAYMENT_GATEWAY_DRIVER=mock
 * always succeeds and fabricates a transaction reference, the same convention as DvlaService/
 * MtdSubmissionService — there's no real merchant account to charge against in this environment.
 */
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('PAYMENT_GATEWAY_DRIVER', 'mock');
  }

  async charge(amount: number, method: PaymentMethod): Promise<ChargeResult> {
    if (this.driver === 'mock') {
      const providerRef = `PAY-MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
      this.logger.log(`[payment gateway mock] charged £${amount.toFixed(2)} via ${method} → ${providerRef}`);
      return { success: true, providerRef };
    }

    this.logger.warn(`Payment gateway driver "${this.driver}" not implemented locally`);
    return { success: false, failureReason: 'Payment gateway not configured for this environment' };
  }
}
