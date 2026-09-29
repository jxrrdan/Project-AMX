import { Module } from '@nestjs/common';
import { ServicePlansController } from './service-plans.controller';
import { ServicePlansService } from './service-plans.service';

@Module({
  controllers: [ServicePlansController],
  providers: [ServicePlansService],
})
export class ServicePlansModule {}
