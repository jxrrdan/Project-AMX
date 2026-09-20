import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { AftersalesInvoiceController } from './aftersales-invoice.controller';
import { AftersalesInvoiceService } from './aftersales-invoice.service';

@Module({
  imports: [DealersModule, DocumentTemplatesModule],
  controllers: [AftersalesInvoiceController],
  providers: [AftersalesInvoiceService],
})
export class AftersalesModule {}
