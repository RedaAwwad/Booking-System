import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { ExternalApiModule } from '../external-api/external-api.module';
import { HotelBooking } from './entities/hotel-booking.entity';

@Module({
  imports: [
    ExternalApiModule,
    TypeOrmModule.forFeature([HotelBooking]),
  ],
  controllers: [HotelsController],
  providers: [HotelsService],
})
export class HotelsModule {}
