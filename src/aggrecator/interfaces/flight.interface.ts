// src/aggregator/interfaces/flight.interface.ts
export interface Flight {
  source: string;
  id: string;
  price: number;
  currency: string;
  airline: string;
  departureTime: Date;
  arrivalTime: Date;
}