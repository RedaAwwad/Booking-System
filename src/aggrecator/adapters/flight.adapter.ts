// src/aggregator/adapters/flight.adapter.ts
import { FlightSearchDto } from "../DTO/flight-search.dto";
import { Flight } from "../interfaces/flight.interface";

export class FlightAdapter {
  
  static fromDuffel(raw: any): Flight {
    return {
      source: 'Duffel',
      id: raw.id,
      price: parseFloat(raw.total_amount),
      currency: raw.total_currency,
      airline: raw.owner?.name || raw.owner?.iata_code || 'Unknown Airline',
      departureTime: new Date(raw.slices?.[0]?.segments?.[0]?.departing_at),
      arrivalTime: new Date(raw.slices?.[0]?.segments?.[raw.slices[0].segments.length - 1]?.arriving_at),
    };
  }

}