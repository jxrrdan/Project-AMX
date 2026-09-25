import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { EmailService } from './email/email.service';
import { SmsService } from './sms/sms.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { AiService } from './ai/ai.service';
import { AuditService } from './audit/audit.service';
import { PdfService } from './pdf/pdf.service';
import { DvlaService } from './dvla/dvla.service';
import { VehicleValuationService } from './valuation/vehicle-valuation.service';
import { PaymentGatewayService } from './payments/payment-gateway.service';
import { TenancyScopeService } from './tenancy/tenancy-scope.service';

const PROVIDERS = [
  StorageService,
  EmailService,
  SmsService,
  WhatsAppService,
  AiService,
  AuditService,
  PdfService,
  DvlaService,
  VehicleValuationService,
  PaymentGatewayService,
  TenancyScopeService,
];

@Global()
@Module({
  providers: PROVIDERS,
  exports: PROVIDERS,
})
export class CommonModule {}
