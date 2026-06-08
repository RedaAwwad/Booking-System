# Duffel Provider

## What is Duffel?

[Duffel](https://duffel.com) is a travel tech company that provides an API and JavaScript SDK for booking flights programmatically. Unlike raw REST APIs, Duffel provides an official npm package (`@duffel/api`) that handles authentication, request/response serialization, and TypeScript types for you.

## SDK Setup (`duffel-flights.adapter.ts`)

```typescript
import { Duffel } from '@duffel/api';

// In the constructor:
const token = this.configService.get<string>('DUFFEL_API_TOKEN');
this.duffel = new Duffel({ token: token ?? '' });
```

The `Duffel` class is the root client. Once instantiated, it exposes sub-clients for different resources:
- `this.duffel.offerRequests` — for searching flights
- `this.duffel.orders` — for booking flights (not used here yet)
- `this.duffel.offers` — for fetching individual offers

## Duffel's Domain Model

### Slices
A **slice** represents a directional journey leg. You always think in slices:
- One-way flight: 1 slice (`LHR → JFK`)
- Round trip: 2 slices (`LHR → JFK` and `JFK → LHR`)
- Each slice can have multiple **segments** if there are layovers.

### Segments
A **segment** is one physical airplane flight (one takeoff + one landing). A slice with a layover has 2+ segments.

### Offer Request → Offers
Duffel works in this sequence:
1. You create an **Offer Request** with the journey parameters.
2. Duffel contacts airlines and returns a list of **Offers**.
3. Each Offer has a price, an airline, and a list of slices (each with segments).

We use `return_offers: true` so that the offers are included directly in the response, rather than having to call a separate list endpoint.

## Local Types vs SDK Types (`duffel-flights.types.ts`)

We maintain a **local, minimal** version of the Duffel offer type:

```typescript
export interface DuffelFlightOffer {
  id: string;
  total_amount: string;     // ← string, not number (Duffel always returns as string)
  total_currency: string;
  owner: { name: string; iata_code: string };
  slices: { segments: { ... }[] }[];
}
```

**Why not import the SDK's types directly?**
The SDK's `Offer` type is very large (hundreds of fields) and some of its required fields (like `available_services`) are not needed for our use case. Our local type captures only the fields we actually map to the internal `Flight` interface. This makes the code easier to understand and the mapping explicit.

**Trade-off:** If Duffel changes field names, the SDK types would reflect that change — but our local type would not. This is documented as a type safety gap (see the main README).

## Environment Variables

| Variable | Description | Where used |
|---|---|---|
| `DUFFEL_API_TOKEN` | Your Duffel API key | Constructor: `new Duffel({ token })` |

## Important Notes for Beginners

1. **`total_amount` is always a string in Duffel.** Airlines return prices as strings (e.g. `"123.45"`). Our `parseFloat()` converts it to a number.
2. **The first slice's first segment is the "main" flight.** For display purposes, we always use `slices[0].segments[0]` for departure info and `slices[0].segments[last]` for arrival info. In a multi-segment (layover) journey, `segments[last]` gives the final landing.
3. **`fare_brand_name` may not match our `CabinClass` enum.** Duffel returns airline-specific brand names like `"Economy Flex"` or `"Business Light"`, not clean enum values. This is a known type mismatch.
