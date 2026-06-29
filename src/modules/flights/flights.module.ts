import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

import { FlightBooking } from './entities/flight-booking.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExternalApiModule } from '../external-api/external-api.module';
import { FlightOutboxMessage } from './entities/flight-outbox-message.entity';
import { FlightOutboxService } from './flight-outbox.service';
import { FlightPublisherService } from './flight-publisher.service';
import { FlightEventDispatcherService } from './flight-event-dispatcher.service';
import { FlightBookingSubscriber } from './subscribers/flight-booking.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightBooking, FlightOutboxMessage]),
    TransactionsModule,
    ExternalApiModule,
  ],
  controllers: [FlightsController],
  providers: [
    FlightsService,
    FlightOutboxService,
    FlightPublisherService,
    FlightEventDispatcherService,
    FlightBookingSubscriber,
  ],
  exports: [FlightsService],
})
export class FlightsModule {}
