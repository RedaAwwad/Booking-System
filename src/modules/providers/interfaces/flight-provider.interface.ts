import { Flight } from '../../flights/flights.types';
import { FlightsSearchDto } from '../../flights/dto/flights-search.dto';

export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightsSearchDto): Promise<Flight[]>;
  formatFlightResponse<T>(providerFlight: T): Flight;
}
