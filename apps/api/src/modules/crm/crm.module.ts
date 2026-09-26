import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { LedgerModule } from '../ledger/ledger.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CommunicationsService } from './communications.service';
import { CustomerInvoiceService } from './customer-invoice.service';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [DealersModule, DocumentTemplatesModule, LedgerModule, VehiclesModule],
  controllers: [CrmController],
  providers: [CrmService, CommunicationsService, WorkflowsService, CustomerInvoiceService],
  exports: [CrmService],
})
export class CrmModule {}
