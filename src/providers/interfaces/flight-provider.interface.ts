import { FlightSearchDto } from 'src/aggrecator/DTO/flight-search.dto';
import { Flight } from 'src/aggrecator/interfaces/flight.interface';

export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightSearchDto): Promise<Flight[]>;
}