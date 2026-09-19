import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS abstraction. Production target is AWS SNS or Twilio (Twilio recommended for inbound
 * two-way SMS per the spec); SMS_DRIVER=console logs the message locally.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('SMS_DRIVER', 'console');
  }

  async send(to: string, body: string): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(`[SMS → ${to}] ${body}`);
      return;
    }

    this.logger.warn(`SMS driver "${this.driver}" not implemented locally`);
  }
}
