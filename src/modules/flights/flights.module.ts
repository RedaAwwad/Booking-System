import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { ExternalApiModule } from '../external-api/external-api.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { FlightBooking } from './entities/flight-booking.entity';

@Module({
  imports: [
    ExternalApiModule,
    TypeOrmModule.forFeature([FlightBooking]),
    TransactionsModule,
  ],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}
