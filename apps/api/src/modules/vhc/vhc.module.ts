import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { VhcController } from './vhc.controller';
import { VhcService } from './vhc.service';

@Module({
  imports: [NotificationsModule],
  controllers: [VhcController],
  providers: [VhcService],
})
export class VhcModule {}
