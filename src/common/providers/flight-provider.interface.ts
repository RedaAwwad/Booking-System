import { Flight } from '../interfaces/flight.interface';
import { SearchFlightDto } from '../../modules/flights/dto/search-flight.dto';

export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: SearchFlightDto): Promise<Flight[]>;
}
