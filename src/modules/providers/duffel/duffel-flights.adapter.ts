import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Duffel } from '@duffel/api';
import { IFlightProvider } from '../interfaces/flight-provider.interface';
import { FlightsSearchDto } from '../../flights/dto/flights-search.dto';
import {
  DuffelFlightOffer,
  DuffelOfferRequestError,
} from './duffel-flights.types';
import { Flight, CabinClass } from 'src/modules/flights/flights.types';
import type {
  CreateOfferRequestPassenger,
  CreateOfferRequestSlice,
} from '@duffel/api/types';


@Injectable()
export class DuffelFlightsAdapter implements IFlightProvider {
  readonly providerName = 'Duffel';
  private readonly logger: Logger;
  private duffel: Duffel;

  constructor(private readonly configService: ConfigService) {
    this.logger = new Logger(this.providerName);
    const token = this.configService.get<string>('DUFFEL_API_TOKEN');
    this.duffel = new Duffel({
      token: token ?? '',
    });
  }

  async searchFlights(query: FlightsSearchDto): Promise<Flight[]> {
    try {
      const passengers: CreateOfferRequestPassenger[] = Array.from(
        { length: query.adults_count },
        () => ({ type: 'adult' as const }),
      );

      const slices: CreateOfferRequestSlice[] = [
        {
          origin: query.origin,
          destination: query.destination,
          departure_date: query.departure_date,
          arrival_time: null,
          departure_time: null,
        },
      ];

      if (query.return_date) {
        slices.push({
          origin: query.destination,
          destination: query.origin,
          departure_date: query.return_date,
          arrival_time: null,
          departure_time: null,
        });
      }

      const duffelOffersResponse = await this.duffel.offerRequests.create({
        slices,
        passengers,
        return_offers: true,
      });

      return duffelOffersResponse.data.offers.map((offer) =>
        this.formatFlightResponse(offer),
      );
    } catch (error) {
      if (
        (error as DuffelOfferRequestError)?.errors &&
        (error as DuffelOfferRequestError)?.errors?.length > 0
      ) {
        this.logger.error(
          `Duffel API Error: ${(error as DuffelOfferRequestError)?.errors[0].message}`,
        );
        throw new UnauthorizedException(
          (error as DuffelOfferRequestError)?.errors[0].message,
        );
      }

      this.logger.error(`Duffel API Error: ${(error as Error)?.message}`);
      throw new BadRequestException((error as Error)?.message);
    }
  }

  private mapDuffelCabinClass(raw: string | undefined): CabinClass | undefined {
    switch (raw?.toLowerCase()) {
      case 'economy':          return CabinClass.ECONOMY;
      case 'premium_economy':  return CabinClass.PREMIUM_ECONOMY;
      case 'business':         return CabinClass.BUSINESS;
      case 'first':            return CabinClass.FIRST;
      default:                 return undefined;
    }
  }

  private formatFlightResponse(providerFlight: DuffelFlightOffer): Flight {
    const flight = providerFlight;

    this.logger.warn('flight = > ', flight);

    return {
      id: flight.id,
      source: this.providerName,
      airline: flight.owner?.name || flight.owner?.iata_code || 'N/A',
      flightNumber: flight.slices?.[0]?.segments?.[0]?.operating_carrier_flight_number || 'N/A',
      departureAirport:
        flight.slices?.[0]?.segments?.[0]?.origin?.iata_code || 'N/A',
      arrivalAirport:
        flight.slices?.[0]?.segments?.[0]?.destination?.iata_code || 'N/A',
      departureTime: new Date(flight.slices?.[0]?.segments?.[0]?.departing_at),
      arrivalTime: new Date(
        flight.slices?.[0]?.segments?.[flight.slices[0].segments.length - 1]
          ?.arriving_at,
      ),
      price: parseFloat(flight.total_amount),
      currency: flight.total_currency,
      cabinClass: this.mapDuffelCabinClass(
        flight.slices?.[0]?.segments?.[0]?.passengers?.[0]?.cabin_class,
      ),
    };
  }
}
