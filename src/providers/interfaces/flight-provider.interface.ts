import { FlightSearchDto } from '../../aggrecator/DTO/flight-search.dto';
import { NormalizedFlight } from '../../aggrecator/interfaces/flight.interface';

export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightSearchDto): Promise<NormalizedFlight[]>;
}
