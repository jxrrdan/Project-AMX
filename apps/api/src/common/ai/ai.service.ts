import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

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
  private bedrock?: BedrockRuntimeClient;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('AI_DRIVER', 'mock');
  }

  async complete(input: AiCompletionInput): Promise<string> {
    if (this.driver === 'mock') {
      const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
      this.logger.debug(`[AI mock] ${lastUserMessage?.content ?? '(no message)'}`);
      return `(mock AI response — configure AI_DRIVER=bedrock in production) Based on the current dealer data, here is a placeholder answer to: "${lastUserMessage?.content ?? ''}"`;
    }

    if (this.driver === 'bedrock') {
      // IAM-authenticated, in-region: dealer PII stays inside AWS. Model ids are configuration
      // (Bedrock inference-profile ids differ per region/account), not hard-coded.
      const modelId = this.config.getOrThrow<string>(
        input.model === 'lightweight' ? 'BEDROCK_MODEL_LIGHTWEIGHT' : 'BEDROCK_MODEL_REASONING',
      );
      this.bedrock ??= new BedrockRuntimeClient({ region: this.config.get<string>('AWS_REGION', 'eu-west-2') });
      const response = await this.bedrock.send(
        new ConverseCommand({
          modelId,
          system: [{ text: input.system }],
          messages: input.messages.map((m) => ({ role: m.role, content: [{ text: m.content }] })),
          inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
        }),
      );
      return response.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
    }

    throw new Error(`Unknown AI_DRIVER "${this.driver}"`);
  }
}
