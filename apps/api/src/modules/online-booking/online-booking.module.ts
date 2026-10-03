import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';

@Module({
  imports: [NotificationsModule],
  controllers: [OnlineBookingController],
  providers: [OnlineBookingService],
})
export class OnlineBookingModule {}
