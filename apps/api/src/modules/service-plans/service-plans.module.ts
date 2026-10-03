import { Module } from '@nestjs/common';
import { AccountCustomersModule } from '../account-customers/account-customers.module';
import { ServicePlansController } from './service-plans.controller';
import { ServicePlansService } from './service-plans.service';

@Module({
  imports: [AccountCustomersModule],
  controllers: [ServicePlansController],
  providers: [ServicePlansService],
  exports: [ServicePlansService],
})
export class ServicePlansModule {}
