import { Flight } from '../../flights/types/flights.types';
import { FlightsSearchDto } from '../../flights/dto/flights-search.dto';

export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightsSearchDto): Promise<Flight[]>;
}
