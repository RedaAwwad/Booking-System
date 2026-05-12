export enum CabinClass {
  ECONOMY = 'economy',
  BUSINESS = 'business',
  FIRST = 'first',
}

export interface Flight {
  id: string;
  source: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  price: number;
  currency: string;
  cabinClass?: CabinClass;
}
