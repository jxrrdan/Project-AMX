import { Module } from '@nestjs/common';
import { AccountCustomersController } from './account-customers.controller';
import { AccountCustomersService } from './account-customers.service';

@Module({
  controllers: [AccountCustomersController],
  providers: [AccountCustomersService],
  exports: [AccountCustomersService],
})
export class AccountCustomersModule {}
