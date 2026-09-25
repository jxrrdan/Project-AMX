import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { FiController } from './fi.controller';
import { FiService } from './fi.service';

@Module({
  imports: [LedgerModule],
  controllers: [FiController],
  providers: [FiService],
})
export class FiModule {}
