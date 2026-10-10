import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

    if (this.driver === 'twilio') {
      const sid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
      const token = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
      const from = this.config.getOrThrow<string>('TWILIO_FROM_NUMBER');
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        new URLSearchParams({ To: to, From: from, Body: body }).toString(),
        { auth: { username: sid, password: token }, timeout: 10_000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return;
    }

    throw new Error(`Unknown SMS_DRIVER "${this.driver}"`);
  }
}
