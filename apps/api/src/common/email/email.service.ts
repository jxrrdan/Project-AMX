import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

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
  private ses?: SESv2Client;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('EMAIL_DRIVER', 'console');
  }

  async send(input: SendEmailInput): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(`[EMAIL → ${input.to}] ${input.subject}\n${input.html}`);
      return;
    }

    if (this.driver === 'ses') {
      this.ses ??= new SESv2Client({ region: this.config.get<string>('AWS_REGION', 'eu-west-2') });
      await this.ses.send(
        new SendEmailCommand({
          FromEmailAddress: this.config.getOrThrow<string>('EMAIL_FROM'),
          Destination: { ToAddresses: [input.to] },
          Content: {
            Simple: {
              Subject: { Data: input.subject, Charset: 'UTF-8' },
              Body: { Html: { Data: input.html, Charset: 'UTF-8' } },
            },
          },
        }),
      );
      return;
    }

    throw new Error(`Unknown EMAIL_DRIVER "${this.driver}"`);
  }
}
