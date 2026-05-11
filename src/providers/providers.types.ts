import { SearchFlightDto } from '../flights/dto/search-flight.dto';

type NormalizedFlight = object;

export interface FlightProvider {
  readonly providerName: string;
  searchFlights(params: SearchFlightDto): Promise<NormalizedFlight[]>;
}

// export interface HotelProvider {
//   readonly providerName: string;
//   searchHotels(params: HotelSearchParams): Promise<NormalizedHotel[]>;
// }
