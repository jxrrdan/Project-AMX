import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { MtdSubmissionService } from './mtd-submission.service';

@Module({
  controllers: [LedgerController],
  providers: [LedgerService, MtdSubmissionService],
  exports: [LedgerService],
})
export class LedgerModule {}
