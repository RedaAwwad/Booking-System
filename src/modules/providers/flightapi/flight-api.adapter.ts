import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IFlightProvider } from '../../../common/providers/flight-provider.interface';
import { Flight } from '../../../common/interfaces/flight.interface';
import { SearchFlightDto, CabinClass } from '../../flights/dto/search-flight.dto';

@Injectable()
export class FlightApiAdapter implements IFlightProvider {
  readonly providerName = 'FlightAPI';
  private readonly logger = new Logger(FlightApiAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.flightapi.io/onewaytrip';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('FLIGHT_API_KEY') || '';
    this.logger.warn('FLIGHT_API_KEY ==>', this.apiKey);
    if (!this.apiKey) {
      this.logger.warn('FLIGHT_API_KEY is not defined');
    }
  }

  async searchFlights(query: SearchFlightDto): Promise<Flight[]> {
    try {
      const url = this.buildUrl(query);
      this.logger.log('url = > ', url);
      this.logger.log(`Fetching from FlightAPI: ${url.replace(this.apiKey, '***')}`);
      const response = await firstValueFrom(this.httpService.get(url));


      if (response.status !== 200) {
        throw new Error(`FlightAPI returned status ${response.status}`);
      }

      return this.mapToCommonInterface(response.data);
    } catch (error) {
      this.logger.error(`FlightAPI Error: ${error.message}`);
      if (error.response?.status === 401) {
        throw new UnauthorizedException('Invalid FlightAPI key');
      }
      throw new BadRequestException(`FlightAPI failure: ${error.message}`);
    }
  }

  private buildUrl(query: SearchFlightDto): string {
    const adults = query.adults_count || 1;
    const children = query.children_count || 0;
    const infants = 0; // FlightAPI requires infants count
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

  private mapToCommonInterface(data: any): Flight[] {
    const itineraries = data.itineraries || [];
    const legs = data.legs || [];
    const carriers = data.carriers || [];

    // Create maps for quick lookup
    const legsMap = new Map<string, any>();
    legs.forEach((leg: any) => legsMap.set(leg.id, leg));

    const carriersMap = new Map<string, any>();
    carriers.forEach((carrier: any) => carriersMap.set(carrier.id, carrier));

    return itineraries.map((itinerary: any) => {
      // For one-way trip, we expect one leg
      const legId = itinerary.leg_ids ? itinerary.leg_ids[0] : null;
      if (!legId) return null;

      const leg = legsMap.get(legId);
      if (!leg) return null;

      const carrierId = (leg as any).carrier_ids ? (leg as any).carrier_ids[0] : null;
      const carrier = carrierId ? carriersMap.get(carrierId) : null;

      return {
        id: itinerary.id,
        source: this.providerName,
        airline: (carrier as any)?.name || 'Unknown',
        flightNumber: (leg as any).segments?.[0]?.flight_number || 'N/A',
        departureAirport: (leg as any).departure_airport_code,
        arrivalAirport: (leg as any).arrival_airport_code,
        departureTime: new Date((leg as any).departure_time),
        arrivalTime: new Date((leg as any).arrival_time),
        price: itinerary.pricing_options?.[0]?.price?.amount || 0,
        currency: itinerary.pricing_options?.[0]?.price?.currency || 'USD',
        cabinClass: (leg as any).segments?.[0]?.cabin_class || 'Economy',
      };
    }).filter((f: any) => f !== null);
  }


}
