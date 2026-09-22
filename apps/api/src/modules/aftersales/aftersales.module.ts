import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AftersalesInvoiceController } from './aftersales-invoice.controller';
import { AftersalesInvoiceService } from './aftersales-invoice.service';

@Module({
  imports: [DealersModule, DocumentTemplatesModule, LedgerModule],
  controllers: [AftersalesInvoiceController],
  providers: [AftersalesInvoiceService],
})
export class AftersalesModule {}
