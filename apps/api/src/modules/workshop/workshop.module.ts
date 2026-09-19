import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkshopGateway } from '../../common/ws/workshop.gateway';
import { WorkshopController } from './workshop.controller';
import { WorkshopService } from './workshop.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkshopController],
  providers: [WorkshopService, WorkshopGateway],
  exports: [WorkshopService],
})
export class WorkshopModule {}
