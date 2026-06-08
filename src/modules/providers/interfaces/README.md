# Provider Interfaces

## Overview

This folder contains the **contracts** that all provider adapters must fulfill. A contract in TypeScript is expressed as an `interface`.

---

## `IFlightProvider`

```typescript
export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightsSearchDto): Promise<Flight[]>;
  formatFlightResponse<T>(providerFlight: T): Flight;
}
```

### Why does this interface exist?

Without this interface, the `FlightExternalApiService` would need to import and depend on each specific adapter class:

```typescript
// ❌ What we'd have without an interface — tightly coupled
import { DuffelFlightsAdapter } from '../providers/duffel/duffel-flights.adapter';
import { FlightApiAdapter } from '../providers/flightapi/flightapi.adapter';

class FlightExternalApiService {
  constructor(
    private duffel: DuffelFlightsAdapter,
    private flightapi: FlightApiAdapter,
  ) {}
}
```

Instead, because both adapters implement `IFlightProvider`, the service only depends on the interface:

```typescript
// ✅ What we have — decoupled
@Inject('FLIGHT_PROVIDERS') private readonly providers: IFlightProvider[]
```

Adding a new provider (e.g. Amadeus) only requires:
1. Creating a new adapter that `implements IFlightProvider`
2. Adding it to the `useFactory` array in `providers.module.ts`
3. Zero changes to `FlightExternalApiService`

This is the **Open/Closed Principle** (open for extension, closed for modification).

---

## `IHotelProvider`

```typescript
export interface IHotelProvider {
  readonly providerName: string;
  searchHotels(query: HotelsSearchDto): Promise<Hotel[]>;
  formatHotelResponse<T>(providerHotel: T): Hotel;
}
```

Mirrors `IFlightProvider` exactly but for hotels. Currently there are no concrete hotel provider adapters registered, but the interface is ready for when they are built.

---

## The Type-Safety Gap in `formatFlightResponse<T>`

Both interfaces declare `formatFlightResponse<T>(providerFlight: T): Flight` with a **generic type parameter `T`**. This was done to allow the interface to be flexible across adapters, but it creates a type safety gap:

```typescript
// The interface allows this:
formatFlightResponse<T>(providerFlight: T): Flight;

// But concrete implementations immediately lose type safety:
formatFlightResponse<T>(providerFlight: T): Flight {
  const flight = providerFlight as DuffelFlightOffer;  // ← cast required
}
```

A `T` that's generic tells TypeScript nothing about the shape of `providerFlight`. Each adapter knows what shape its data has, but the interface doesn't reflect that.

**Why it was done this way:** Keeping the interface generic means all providers can share a single token (`'FLIGHT_PROVIDERS'`) and a single array type (`IFlightProvider[]`). The alternative — making the interface concrete per-provider — would require separate injection tokens and more complex aggregation logic.

**The trade-off:** The current design is simpler to use (one token, one array) at the cost of internal type safety in `formatFlightResponse`. The cast happens once, inside the adapter, and is contained.
