import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Duffel } from '@duffel/api';
import { IFlightProvider } from './interfaces/flight-provider.interface';
import { FlightSearchDto } from '../aggrecator/DTO/flight-search.dto';
import { FlightAdapter } from '../aggrecator/adapters/flight.adapter';
import { NormalizedFlight } from '../aggrecator/interfaces/flight.interface';

@Injectable()
export class DuffelService implements IFlightProvider {
  readonly providerName = 'Duffel';
  private readonly logger = new Logger(DuffelService.name);
  private duffel: Duffel;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('DUFFEL_API_TOKEN');
    if (!token) {
      this.logger.warn('DUFFEL_API_TOKEN is not defined in the environment variables.');
    }
    
    this.duffel = new Duffel({
      token: token || 'fallback_token',
    });
  }

  /**
   * Search for flight offers using Duffel API
   */
  async searchFlights(params: FlightSearchDto): Promise<NormalizedFlight[]> {
    try {
      const passengers = Array.from({ length: params.adults }, () => ({
        type: 'adult' as const,
      })) as any[];

      const slices: any[] = [
        {
          origin: params.originLocationCode,
          destination: params.destinationLocationCode,
          departure_date: params.departureDate,
        },
      ];

      if (params.returnDate) {
        slices.push({
          origin: params.destinationLocationCode,
          destination: params.originLocationCode,
          departure_date: params.returnDate,
        });
      }

      // 1. Create an offer request
      const offerRequest = await this.duffel.offerRequests.create({
        slices,
        passengers,
        return_offers: true,
        max_connections: 0, // Direct flights only by default, can be parameterised
      });

      // 2. The offers are returned within the offerRequest object
      const rawOffers = offerRequest.data.offers;
      return rawOffers.map(offer => FlightAdapter.fromDuffel(offer));
    } catch (error) {
      this.logger.error(`Duffel API Error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
