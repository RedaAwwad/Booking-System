import type { Flight } from '../flights.types';
import { FlightsSearchDto } from '../dto/flights-search.dto';

export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightsSearchDto): Promise<Flight[]>;
  formatFlightResponse<T>(providerFlight: T): Flight;
}

export const FLIGHT_PROVIDERS = 'FLIGHT_PROVIDERS';
