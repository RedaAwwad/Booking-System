import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IFlightProvider } from '../interfaces/flight-provider.interface';
import { FlightsSearchDto } from '../../flights/dto/flights-search.dto';
import {
  FlightapiError,
  FlightapiResponse,
  FlightapiItinerary,
  FlightapiLeg,
  FlightapiCarrier,
} from './flightapi.types';
import { Flight, CabinClass } from '../../flights/flights.types';

@Injectable()
export class FlightApiAdapter implements IFlightProvider {
  readonly providerName = 'Flightapi';
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.logger = new Logger(FlightApiAdapter.name);
    this.apiKey = this.configService.get<string>('FLIGHTAPI_API_KEY') || '';
    this.baseUrl = this.configService.get<string>('FLIGHTAPI_API_URL') || '';
  }

  async searchFlights(query: FlightsSearchDto): Promise<Flight[]> {
    try {
      const url = this.buildUrl(query);
      this.logger.log('url = > ', url);
      this.logger.log(
        `Fetching from ${this.providerName}: ${url.replace(this.apiKey, '***')}`,
      );
      const response = await firstValueFrom(this.httpService.get(url));

      if (response.status !== 200) {
        throw new Error(
          `${this.providerName} returned status ${response.status}`,
        );
      }

      const data = response.data as FlightapiResponse;
      const itineraries = data.itineraries || [];

      return itineraries
        .map((itinerary) => {
          return this.formatFlightResponse<{
            itinerary: FlightapiItinerary;
            legs: FlightapiLeg[];
            carriers: FlightapiCarrier[];
          }>({
            itinerary,
            legs: data.legs || [],
            carriers: data.carriers || [],
          });
        })
        .filter((f): f is Flight => f !== null);
    } catch (error) {
      this.logger.error(
        `${this.providerName} Error: ${(error as Error).message}`,
      );
      if ((error as FlightapiError).response?.status === 401) {
        throw new UnauthorizedException(`Invalid ${this.providerName} key`);
      }
      throw new BadRequestException(
        `${this.providerName} failure: ${(error as Error).message}`,
      );
    }
  }

  private buildUrl(query: FlightsSearchDto): string {
    const adults = query.adults_count || 1;
    const children = query.children_count || 0;
    const infants = 0; // Flightapi requires infants count
    const cabin = this.mapCabinClass(query.cabin_class);
    const currency = query.currency || 'USD';

    return `${this.baseUrl}/${this.apiKey}/${query.origin}/${query.destination}/${query.departure_date}/${adults}/${children}/${infants}/${cabin}/${currency}`;
  }

  private mapCabinClass(cabin?: CabinClass): string {
    switch (cabin) {
      case CabinClass.BUSINESS:
        return 'Business';
      case CabinClass.FIRST:
        return 'First';
      case CabinClass.ECONOMY:
      default:
        return 'Economy';
    }
  }

  formatFlightResponse<T>(context: T): Flight {
    const { itinerary, legs, carriers } = context as unknown as {
      itinerary: FlightapiItinerary;
      legs: FlightapiLeg[];
      carriers: FlightapiCarrier[];
    };

    // Create maps for quick lookup
    const legsMap = new Map<string, FlightapiLeg>();
    legs.forEach((leg) => legsMap.set(leg.id, leg));

    const carriersMap = new Map<string, FlightapiCarrier>();
    carriers.forEach((carrier) => carriersMap.set(carrier.id, carrier));

    const legId = itinerary.leg_ids ? itinerary.leg_ids[0] : null;
    const leg = legId ? legsMap.get(legId) : null;

    const carrierId = leg?.carrier_ids ? leg?.carrier_ids[0] : null;
    const carrier = carrierId ? carriersMap.get(carrierId) : null;

    return {
      id: itinerary.id,
      source: this.providerName,
      airline: carrier?.name || 'Unknown',
      flightNumber: leg?.segments?.[0]?.flight_number || 'N/A',
      departureAirport: leg?.departure_airport_code || 'N/A',
      arrivalAirport: leg?.arrival_airport_code || 'N/A',
      departureTime: leg?.departure_time
        ? new Date(leg?.departure_time)
        : new Date(),
      arrivalTime: leg?.arrival_time ? new Date(leg?.arrival_time) : new Date(),
      price: itinerary.pricing_options?.[0]?.price?.amount || 0,
      currency: itinerary.pricing_options?.[0]?.price?.currency || 'USD',
      cabinClass: leg?.segments?.[0]?.cabin_class as unknown as CabinClass,
    };
  }
}
