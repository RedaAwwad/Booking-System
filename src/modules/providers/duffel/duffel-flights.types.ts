import { CabinClass } from '../../flights/flights.types';

export interface DuffelOfferRequestError {
  errors: Array<{ message: string }>;
}

export interface DuffelFlightOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: {
    name: string;
    iata_code: string;
  };
  slices: {
    segments: {
      departing_at: string;
      arriving_at: string;
      flight_number: string;
      origin: {
        iata_code: string;
      };
      destination: {
        iata_code: string;
      };
      fare_brand_name: CabinClass;
    }[];
  }[];
}
