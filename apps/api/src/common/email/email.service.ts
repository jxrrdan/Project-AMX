import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Email abstraction. Production target is AWS SES; EMAIL_DRIVER=console logs the rendered email
 * instead of sending it, so nurture workflows and transactional mail (handover confirmations,
 * PDI notifications, deal-sheet PDFs) are fully exercisable without AWS credentials locally.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('EMAIL_DRIVER', 'console');
  }

  async send(input: SendEmailInput): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(`[EMAIL → ${input.to}] ${input.subject}\n${input.html}`);
      return;
    }

    this.logger.warn(`Email driver "${this.driver}" not implemented locally`);
  }
}
