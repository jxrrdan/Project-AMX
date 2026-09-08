import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { EmailService } from './email/email.service';
import { SmsService } from './sms/sms.service';
import { AiService } from './ai/ai.service';
import { AuditService } from './audit/audit.service';
import { PdfService } from './pdf/pdf.service';

@Global()
@Module({
  providers: [StorageService, EmailService, SmsService, AiService, AuditService, PdfService],
  exports: [StorageService, EmailService, SmsService, AiService, AuditService, PdfService],
})
export class CommonModule {}
