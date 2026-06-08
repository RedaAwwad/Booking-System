# Providers Module

## Overview

The **Providers Module** is the boundary layer between your application and the real world. Every time a user searches for flights, the request eventually reaches this module. Its sole job is to speak the language of each external API, translate the request into that language, fire the request, and then translate the response back into your application's own internal language (the `Flight` interface).

Think of it like a **universal translator**: the rest of the app speaks in one clean dialect, and this module knows the many different dialects of external services like Duffel and FlightAPI.

---

## Folder Structure

```
providers/
├── interfaces/
│   ├── flight-provider.interface.ts   # The contract every flight provider must fulfill
│   └── hotel-provider.interface.ts    # The contract every hotel provider must fulfill
├── duffel/
│   ├── duffel-flights.adapter.ts      # Duffel integration — uses the @duffel/api SDK
│   └── duffel-flights.types.ts        # Local types for Duffel's API responses
├── flightapi/
│   ├── flightapi.adapter.ts           # FlightAPI.io integration — uses plain HTTP
│   └── flightapi.types.ts             # Local types for FlightAPI.io responses
├── providers.module.ts                # NestJS module: registers adapters and exports FLIGHT_PROVIDERS token
└── README.md                          # This file
```

---

## The Core Idea: The Adapter Pattern

This module uses the **Adapter Pattern**. The problem it solves is that Duffel and FlightAPI have completely different APIs:
- Duffel has its own official JavaScript SDK (`@duffel/api`).
- FlightAPI.io uses a plain REST HTTP endpoint with URL path parameters.

Without adapters, every place in the code that needs flights would have to know "are we using Duffel right now or FlightAPI?" That would be a mess.

Instead, both adapters implement the same **interface contract** (`IFlightProvider`):

```typescript
export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightsSearchDto): Promise<Flight[]>;
  formatFlightResponse<T>(providerFlight: T): Flight;
}
```

This means the `FlightExternalApiService` (in the External API module) never sees a `DuffelFlightOffer` or a `FlightapiItinerary`. It only ever sees a `Flight[]`. It doesn't care which provider returned the data.

---

## How the Module is Registered (`providers.module.ts`)

```typescript
{
  provide: 'FLIGHT_PROVIDERS',
  useFactory: (duffel, flightApi) => [duffel, flightApi],
  inject: [DuffelFlightsAdapter, FlightApiAdapter],
}
```

This is a **multi-provider token**. Instead of injecting a single service by class name, `FlightExternalApiService` injects `@Inject('FLIGHT_PROVIDERS')` and receives an **array** of all registered flight providers. This is how new providers can be added to the system without changing the External API service at all — just add the new adapter to the `useFactory` array.

---

## Provider 1: Duffel (`duffel/`)

### What is Duffel?
Duffel is a flight booking platform that provides a JavaScript/TypeScript SDK (`@duffel/api`). You don't make raw HTTP calls; instead you call SDK methods like `this.duffel.offerRequests.create(...)`, and the SDK handles authentication, serialization, and HTTP under the hood.

### The Two-Phase Duffel Concept: Offer Request vs Offer

This is the most important thing to understand about Duffel. It works in two phases:

| Phase | What it is | What you send | What you receive |
|---|---|---|---|
| **Offer Request** | A search query | `{ passengers, slices }` | A list of `Offer` objects |
| **Offer** | A specific bookable flight | — | Price, airline, times, cabin class |

A **Slice** is a leg of the journey. One-way = 1 slice. Round-trip = 2 slices (outbound + return). Each slice can have multiple **Segments** (if the journey has layovers). Our adapter always uses 1 slice for one-way and 2 slices for round-trip.

### `searchFlights` Step-by-Step

```
1. Build passengers array   → [{ type: 'adult' }, { type: 'adult' }, ...]
                               One entry per adult in query.adults_count

2. Build slices array        → [{ origin, destination, departure_date }]
                               A second slice is pushed if query.return_date exists

3. Call Duffel SDK           → this.duffel.offerRequests.create({ slices, passengers, return_offers: true })
                               return_offers: true means the response immediately contains offers —
                               otherwise you'd have to make a separate call to list them

4. Map offers to Flight[]    → duffelOffersResponse.data.offers.map(offer => this.formatFlightResponse(offer))
                               Each Duffel 'Offer' is translated to our internal 'Flight' interface
```

### `formatFlightResponse` — The Translation Layer

This method converts from Duffel's complex `Offer` shape to our simple `Flight` interface. The key mapping is:

| `Flight` field | Source in Duffel `Offer` | Notes |
|---|---|---|
| `id` | `offer.id` | Duffel's unique offer ID |
| `source` | `'Duffel'` (hardcoded) | Provider name |
| `airline` | `offer.owner.name` or `.iata_code` | The airline operating the first leg |
| `flightNumber` | `offer.slices[0].segments[0].flight_number` | First segment of first slice |
| `departureAirport` | `offer.slices[0].segments[0].origin.iata_code` | e.g. `'LHR'` |
| `arrivalAirport` | `offer.slices[0].segments[0].destination.iata_code` | e.g. `'JFK'` |
| `departureTime` | `offer.slices[0].segments[0].departing_at` | ISO 8601 string → `Date` |
| `arrivalTime` | `offer.slices[0].segments[last].arriving_at` | Last segment = final landing |
| `price` | `parseFloat(offer.total_amount)` | String in Duffel → Number |
| `currency` | `offer.total_currency` | e.g. `'USD'` |
| `cabinClass` | `offer.slices[0].segments[0].fare_brand_name` | May not match our enum exactly |

> **Why `slices[0].segments[last]` for arrivalTime?**
> A journey with a layover has multiple segments. `segments[0]` departs from the origin, but `segments[last]` is the flight that actually lands at the destination. Using `segments[0]` for arrival time would give you the time you land at the layover airport, not the final destination.

### Error Handling in Duffel

Duffel errors have a special shape. When the SDK throws, the error object may contain a `.errors` array (distinct from the standard `Error.message`). The adapter checks for this first:

```typescript
// Duffel's custom error shape
if ((error as DuffelOfferRequestError)?.errors?.length > 0) {
  throw new UnauthorizedException(error.errors[0].message);
}
// Standard JS error fallback
throw new BadRequestException((error as Error)?.message);
```

---

## Provider 2: FlightAPI.io (`flightapi/`)

### What is FlightAPI.io?
FlightAPI.io is a simpler, REST-based flight data service. There is no SDK — you simply call a URL with path parameters, and you get JSON back via `HttpService` (Axios under the hood, provided by NestJS's `@nestjs/axios` package).

### URL Structure

The URL is built in `buildUrl()` and has this format:
```
{BASE_URL}/{API_KEY}/{origin}/{destination}/{departure_date}/{adults}/{children}/{infants}/{cabin}/{currency}
```

For example:
```
https://api.flightapi.io/oneway/your_key/LHR/JFK/2026-06-30/1/0/0/Economy/USD
```

All the parameters are embedded directly in the URL path — there is no request body.

### Cabin Class Mapping

FlightAPI.io uses its own string values for cabin class. The `mapCabinClass()` method handles this translation:

| Internal `CabinClass` enum | FlightAPI.io string |
|---|---|
| `CabinClass.ECONOMY` | `'Economy'` |
| `CabinClass.BUSINESS` | `'Business'` |
| `CabinClass.FIRST` | `'First'` |

### The FlightAPI.io Data Model (why it's complex)

FlightAPI.io returns a **denormalized, flat response** with three separate arrays:

```
{
  itineraries: [...]   ← The actual flight options (each has leg_ids[])
  legs: [...]          ← The physical journey legs (each has carrier_ids[], segments[])
  carriers: [...]      ← The airlines (each has a name and iata code)
}
```

These are **joined by ID references**, like a relational database result. An itinerary references leg IDs → legs reference carrier IDs → carriers have the airline name. The `formatFlightResponse` method manually reassembles this:

```
Step 1: Build Maps for O(1) lookup
  legsMap:     Map<legId, FlightapiLeg>
  carriersMap: Map<carrierId, FlightapiCarrier>

Step 2: Get the first leg for this itinerary
  const legId = itinerary.leg_ids[0];
  const leg = legsMap.get(legId);

Step 3: Get the carrier (airline) for that leg
  const carrierId = leg.carrier_ids[0];
  const carrier = carriersMap.get(carrierId);

Step 4: Build the Flight object from the assembled parts
```

> **Why use `Map` instead of `.find()`?**
> The response could have dozens of legs and carriers. Using `.find()` in a loop = O(n²). Using a `Map` for lookup = O(n) total. It's a deliberate performance choice.

### Error Handling in FlightAPI.io

FlightAPI.io errors are standard Axios errors, so the check is on the HTTP response status code:

```typescript
if ((error as FlightapiError).response?.status === 401) {
  throw new UnauthorizedException(`Invalid ${this.providerName} key`);
}
throw new BadRequestException(...);
```

---

## Type Safety Analysis

> The following section identifies the places in the current codebase where `any` is used as a type, explains **why** the `any` was necessary, and what the **correct type** would be when a proper solution is applied. No code changes are made here — this is documentation to guide a future refactoring.

### `duffel-flights.adapter.ts`

#### 1. `passengers: any[]` (line 35)
```typescript
const passengers = Array.from({ length: query.adults_count }, () => ({
  type: 'adult' as const,
})) as any[];
```
- **Why `any[]`?** The SDK type for a passenger is `CreateOfferRequestAdultPassenger`, which requires `age?: never` and `fare_type?: never` explicitly. Our minimal object `{ type: 'adult' as const }` technically satisfies the type, but the `as any[]` bypasses the strict check.
- **Correct type:** `import type { CreateOfferRequestPassenger } from '@duffel/api';` — use `CreateOfferRequestPassenger[]`.

#### 2. `slices: any[]` (line 37)
```typescript
const slices: any[] = [{ origin, destination, departure_date }];
```
- **Why `any[]`?** The SDK's `CreateOfferRequestSlice` declares `arrival_time` and `departure_time` as required fields (typed as `TimeRangeFilter | null`). Since we don't use them, TypeScript complains. `any[]` bypasses this check.
- **Correct type:** `import type { CreateOfferRequestSlice } from '@duffel/api';` — use `CreateOfferRequestSlice[]` and explicitly pass `arrival_time: null, departure_time: null` to satisfy the required fields.

#### 3. `offer as unknown as DuffelFlightOffer` (line 61)
```typescript
offer as unknown as DuffelFlightOffer
```
- **Why `as unknown as`?** The SDK returns `Omit<Offer, 'available_services'>` from the `.create()` call. Our local `DuffelFlightOffer` interface is a **subset** of the full SDK `Offer` type. They are not assignment-compatible by TypeScript's structural typing, requiring the double cast.
- **Correct approach:** Either use the SDK's `Offer` type directly in `formatFlightResponse`, or extract only the fields we need using `Pick<Offer, 'id' | 'total_amount' | 'total_currency' | 'owner' | 'slices'>`.

#### 4. Generic `formatFlightResponse<T>(providerFlight: T)` (line 82)
```typescript
formatFlightResponse<T>(providerFlight: T): Flight {
  const flight = providerFlight as DuffelFlightOffer;
```
- **Why generic `T`?** The `IFlightProvider` interface declares this method as generic to be flexible across different adapters. But inside this specific adapter, we immediately cast to `DuffelFlightOffer`.
- **Correct approach:** The interface itself is a type-safety gap. A better design would be `formatFlightResponse(providerFlight: DuffelFlightOffer): Flight` in the concrete class, with the interface being non-generic.

### `flightapi.adapter.ts`

#### 5. `context as unknown as { itinerary; legs; carriers }` (line 100)
```typescript
formatFlightResponse<T>(context: T): Flight {
  const { itinerary, legs, carriers } = context as unknown as {
    itinerary: FlightapiItinerary;
    legs: FlightapiLeg[];
    carriers: FlightapiCarrier[];
  };
```
- **Why `as unknown as`?** Same interface contract problem as above. FlightAPI.io's data structure doesn't fit the simple "one object in = one Flight out" shape. The adapter bundles multiple arrays into a context object and uses the generic `T` to pass it through, then casts it back.
- **Correct approach:** Remove the generic from the interface; define a local `FlightapiContext` type and have `formatFlightResponse(context: FlightapiContext): Flight` as the concrete method signature.

#### 6. `leg?.segments?.[0]?.cabin_class as unknown as CabinClass` (line 132)
```typescript
cabinClass: leg?.segments?.[0]?.cabin_class as unknown as CabinClass,
```
- **Why `as unknown as`?** `FlightapiLeg.segments[].cabin_class` is typed as `string`. Our internal `CabinClass` is an enum (`'economy' | 'business' | 'first'`). A `string` is not directly assignable to a string enum without a cast.
- **Correct approach:** Use a mapper function: `private mapFlightapiCabinClass(raw: string): CabinClass | undefined` with a `switch/case` that returns `undefined` for unknown values.

### `flight-external-api.service.ts` (External API Module — related)

#### 7. `errors: any[]`
```typescript
async handle(query: FlightsSearchDto): Promise<{ data: Flight[]; errors: any[] }>
```
- **Why `any[]`?** Error objects from different providers have different shapes, and the error collector is intentionally generic.
- **Correct type:** Define `interface ProviderError { provider: string; error: string; }` and use `ProviderError[]`.

---

## Sequence Diagram

See [`providers_sequence.md`](./providers_sequence.md) for the full flow.
