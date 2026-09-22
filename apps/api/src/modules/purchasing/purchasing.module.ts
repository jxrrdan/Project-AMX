import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { PartsModule } from '../parts/parts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AiInvoiceExtractionService } from './ai-invoice-extraction.service';
import { ManufacturerPaymentsController } from './manufacturer-payments.controller';
import { ManufacturerPaymentsService } from './manufacturer-payments.service';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';

@Module({
  imports: [DealersModule, PartsModule, LedgerModule],
  controllers: [PurchasingController, ManufacturerPaymentsController],
  providers: [PurchasingService, AiInvoiceExtractionService, ManufacturerPaymentsService],
})
export class PurchasingModule {}
