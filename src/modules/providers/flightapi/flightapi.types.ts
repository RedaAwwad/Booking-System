export interface FlightapiError {
  response: {
    status: number;
  };
}

export interface FlightapiResponse {
  itineraries: FlightapiItinerary[];
  legs: FlightapiLeg[];
  carriers: FlightapiCarrier[];
}

export interface FlightapiItinerary {
  id: string;
  leg_ids: string[];
  pricing_options: Array<{
    price: {
      amount: number;
      currency: string;
    };
  }>;
}

export interface FlightapiLeg {
  id: string;
  departure_airport_code: string;
  arrival_airport_code: string;
  departure_time: string;
  arrival_time: string;
  carrier_ids: string[];
  segments: Array<{
    flight_number: string;
    cabin_class: string;
  }>;
}

export interface FlightapiCarrier {
  id: string;
  name: string;
  iata: string;
}
