import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { ExternalApiModule } from '../external-api/external-api.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { HotelBooking } from './entities/hotel-booking.entity';
import { HotelBookingSubscriber } from './subscribers/hotel-booking.subscriber';
import { HotelOutboxMessage } from './entities/hotel-outbox-message.entity';
import { HotelOutboxService } from './hotel-outbox.service';
import { HotelPublisherService } from './hotel-publisher.service';
import { HotelEventDispatcherService } from './hotel-event-dispatcher.service';

@Module({
  imports: [
    ExternalApiModule,
    TypeOrmModule.forFeature([HotelBooking, HotelOutboxMessage]),
    TransactionsModule,
  ],
  controllers: [HotelsController],
  providers: [
    HotelsService,
    // Subscriber is a NestJS provider so it gets full DI (ClsService, OutboxService,
    // ConfigService). Its constructor registers itself with TypeORM's DataSource.
    HotelBookingSubscriber,
    HotelOutboxService,
    HotelPublisherService,
    HotelEventDispatcherService,
  ],
})
export class HotelsModule {}
