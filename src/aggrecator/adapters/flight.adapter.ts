// src/aggregator/adapters/flight.adapter.ts
import { FlightSearchDto } from "../DTO/flight-search.dto";
import { NormalizedFlight } from "../interfaces/flight.interface";

export class FlightAdapter {
  
  static fromAmadeus(raw: any): NormalizedFlight {
    return {
      source: 'Amadeus',
      id: raw.id,
      price: parseFloat(raw.price.total),
      currency: raw.price.currency,
      airline: raw.validatingAirlineCodes[0],
      departureTime: new Date(raw.itineraries[0].segments[0].departure.at),
      arrivalTime: new Date(raw.itineraries[0].segments[0].arrival.at),
    };
  }

  static fromSkyscanner(raw: any): NormalizedFlight {
    return {
      source: 'Skyscanner',
      id: raw.id,
      price: raw.price.amount,
      currency: raw.price.unit,
      airline: raw.display_ads?.tracking_id || 'Unknown', // Skyscanner structure varies
      departureTime: new Date(raw.legs[0].departure),
      arrivalTime: new Date(raw.legs[0].arrival),
    };
  }
  /**
   * INBOUND ADAPTER: Converts our internal DTO to Skyscanner's specific API requirements
   */
  static toSkyscannerParams(query: FlightSearchDto) {
    return {
      originSkyId: query.originLocationCode,
      destinationSkyId: query.destinationLocationCode,
      date: query.departureDate,
      returnDate: query.returnDate,
      adults: query.adults,
      
      // Default business rules/constants
      childrens: 0,
      infants: 0,
      cabinClass: 'economy',
      currency: 'USD',
      market: 'US',
      countryCode: 'US',

      // These might eventually come from a Location Service
      originEntityId: '27544008', 
      destinationEntityId: '27537542', 
    };
  }

}