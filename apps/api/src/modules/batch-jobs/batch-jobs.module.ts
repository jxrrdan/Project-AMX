import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServicePlansModule } from '../service-plans/service-plans.module';
import { BatchJobsController } from './batch-jobs.controller';
import { BatchJobsService } from './batch-jobs.service';

@Module({
  imports: [NotificationsModule, ServicePlansModule],
  controllers: [BatchJobsController],
  providers: [BatchJobsService],
})
export class BatchJobsModule {}
