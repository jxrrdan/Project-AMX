import { Module } from '@nestjs/common';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';

@Module({
  controllers: [OnlineBookingController],
  providers: [OnlineBookingService],
})
export class OnlineBookingModule {}
