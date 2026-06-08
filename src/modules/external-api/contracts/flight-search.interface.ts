import type { Flight } from '../../flights/contracts';
import { FlightsSearchDto } from '../../flights/contracts';

export interface FlightSearchResult {
  data: Flight[];
  errors: string[];
}

export interface IFlightSearchService {
  search(query: FlightsSearchDto): Promise<FlightSearchResult>;
}
