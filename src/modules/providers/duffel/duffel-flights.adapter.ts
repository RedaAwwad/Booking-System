import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Duffel } from '@duffel/api';
import { IFlightProvider } from '../../../common/providers/flight-provider.interface';
import { Flight } from '../../../common/interfaces/flight.interface';
import { SearchFlightDto } from '../../flights/dto/search-flight.dto';

@Injectable()
export class DuffelFlightsAdapter implements IFlightProvider {
  readonly providerName = 'Duffel';
  private readonly logger = new Logger(DuffelFlightsAdapter.name);
  private duffel: Duffel;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('DUFFEL_API_TOKEN');
    this.duffel = new Duffel({
      token: token || 'fallback_token',
    });
  }

  async searchFlights(query: SearchFlightDto): Promise<Flight[]> {
    try {
      const passengers = Array.from({ length: query.adults_count }, () => ({
        type: 'adult' as const,
      })) as any[];

      const slices: any[] = [
        {
          origin: query.origin,
          destination: query.destination,
          departure_date: query.departure_date,
        },
      ];

      if (query.return_date) {
        slices.push({
          origin: query.destination,
          destination: query.origin,
          departure_date: query.return_date,
        });
      }

      const offerRequest = await this.duffel.offerRequests.create({
        slices,
        passengers,
        return_offers: true,
      });

      return offerRequest.data.offers.map((offer) => this.mapToCommonInterface(offer));
    } catch (error) {
      if (error?.errors && error?.errors?.length > 0) {
        this.logger.error(`Duffel API Error: ${error.errors[0].message}`);
        throw new UnauthorizedException(error.errors[0].message);
      }

      this.logger.error(`Duffel API Error: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  private mapToCommonInterface(raw: any): Flight {
    return {
      id: raw.id,
      source: this.providerName,
      airline: raw.owner?.name || raw.owner?.iata_code || 'Unknown',
      flightNumber: raw.slices?.[0]?.segments?.[0]?.flight_number || 'N/A',
      departureAirport: raw.slices?.[0]?.origin?.iata_code || 'N/A',
      arrivalAirport: raw.slices?.[0]?.destination?.iata_code || 'N/A',
      departureTime: new Date(raw.slices?.[0]?.segments?.[0]?.departing_at),
      arrivalTime: new Date(raw.slices?.[0]?.segments?.[raw.slices[0].segments.length - 1]?.arriving_at),
      price: parseFloat(raw.total_amount),
      currency: raw.total_currency,
      cabinClass: raw.slices?.[0]?.fare_brand_name,
    };
  }
}
