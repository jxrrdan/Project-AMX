import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiCompletionInput {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  model?: 'reasoning' | 'lightweight';
}

/**
 * AI abstraction for Modules 14/15. Production target is Amazon Bedrock (Claude), invoked with
 * IAM auth so dealer PII never leaves AWS — see Feature Spec §Module 14 "Technical
 * Implementation". AI_DRIVER=mock returns a deterministic canned response so dashboard
 * insights, next-best-action, and the internal assistant are all exercisable end-to-end without
 * live model access or AWS credentials. Swap the `mock` branch for a Bedrock InvokeModel call
 * (with prompt caching on the system prompt + dealer context, per spec) for production.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('AI_DRIVER', 'mock');
  }

  async complete(input: AiCompletionInput): Promise<string> {
    if (this.driver === 'mock') {
      const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
      this.logger.debug(`[AI mock] ${lastUserMessage?.content ?? '(no message)'}`);
      return `(mock AI response — configure AI_DRIVER=bedrock in production) Based on the current dealer data, here is a placeholder answer to: "${lastUserMessage?.content ?? ''}"`;
    }

    this.logger.warn(`AI driver "${this.driver}" not implemented locally`);
    return '';
  }
}
