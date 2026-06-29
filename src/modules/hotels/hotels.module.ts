import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { ExternalApiModule } from '../external-api/external-api.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { HotelBooking } from './entities/hotel-booking.entity';
import { HotelBookingSubscriber } from './subscribers/hotel-booking.subscriber';

@Module({
  imports: [
    ExternalApiModule,
    TypeOrmModule.forFeature([HotelBooking]),
    TransactionsModule,
  ],
  controllers: [HotelsController],
  providers: [
    HotelsService,
    // Subscriber is a NestJS provider so it gets full DI (ClsService, OutboxService,
    // ConfigService). Its constructor registers itself with TypeORM's DataSource.
    HotelBookingSubscriber,
  ],
})
export class HotelsModule {}
