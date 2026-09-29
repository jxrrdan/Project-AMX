import { Module } from '@nestjs/common';
import { AccountCustomersModule } from '../account-customers/account-customers.module';
import { CashieringController } from './cashiering.controller';
import { CashieringService } from './cashiering.service';

@Module({
  imports: [AccountCustomersModule],
  controllers: [CashieringController],
  providers: [CashieringService],
})
export class CashieringModule {}
