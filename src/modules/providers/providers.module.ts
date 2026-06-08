import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DuffelFlightsAdapter } from './duffel/duffel-flights.adapter';
import { FlightApiAdapter } from './flightapi/flightapi.adapter';
import { FLIGHT_PROVIDERS } from '../flights/contracts';
import type { IFlightProvider } from '../flights/contracts';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    DuffelFlightsAdapter,
    FlightApiAdapter,
    {
      provide: FLIGHT_PROVIDERS,
      useFactory: (
        configService: ConfigService,
        duffel: DuffelFlightsAdapter,
        flightApi: FlightApiAdapter,
      ): IFlightProvider[] => {
        const providers: IFlightProvider[] = [duffel];
        const flightApiKey = configService.get<string>('FLIGHTAPI_API_KEY');
        if (flightApiKey?.trim()) {
          providers.push(flightApi);
        }
        return providers;
      },
      inject: [ConfigService, DuffelFlightsAdapter, FlightApiAdapter],
    },
  ],
  exports: [FLIGHT_PROVIDERS],
})
export class ProvidersModule {}
