import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DuffelFlightsAdapter } from './duffel/duffel-flights.adapter';
import { FlightApiAdapter } from './flightapi/flightapi.adapter';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    DuffelFlightsAdapter,
    FlightApiAdapter,
    {
      provide: 'FLIGHT_PROVIDERS',
      useFactory: (
        duffel: DuffelFlightsAdapter,
        flightApi: FlightApiAdapter,
      ) => {
        return [duffel, flightApi];
      },
      inject: [DuffelFlightsAdapter, FlightApiAdapter],
    },
  ],
  exports: ['FLIGHT_PROVIDERS'],
})
export class ProvidersModule {}
