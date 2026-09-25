import { Module } from '@nestjs/common';
import { DealersModule } from '../dealers/dealers.module';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { BankReconciliationService } from './bank-reconciliation.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { MtdSubmissionService } from './mtd-submission.service';

@Module({
  imports: [DealersModule],
  controllers: [LedgerController, BankReconciliationController],
  providers: [LedgerService, MtdSubmissionService, BankReconciliationService],
  exports: [LedgerService],
})
export class LedgerModule {}
