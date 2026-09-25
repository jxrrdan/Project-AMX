import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * WhatsApp abstraction, mirroring SmsService exactly. Production target is the WhatsApp Business
 * API (via Twilio or Meta directly — the same integration Pinewood.AI added to close this same
 * omnichannel gap); WHATSAPP_DRIVER=console logs the message locally.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('WHATSAPP_DRIVER', 'console');
  }

  async send(to: string, body: string): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(`[WhatsApp → ${to}] ${body}`);
      return;
    }

    this.logger.warn(`WhatsApp driver "${this.driver}" not implemented locally`);
  }
}
