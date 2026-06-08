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
The SDK's `Offer` type is very large (hundreds of fields) and some of its required fields (like `available_services`) are not needed for our use case. Our local type captures only the fields we actually map to the internal `Flight` interface.

**Trade-off / Preferred approach:** Maintaining a hand-written local type creates a drift risk — if Duffel renames a field, the SDK's types update but our local type stays broken silently. The better solution (documented in the main README's type safety section) is to use `Pick` from the SDK:
```typescript
import type { Offer } from '@duffel/api';
type DuffelFlightOffer = Pick<Offer, 'id' | 'total_amount' | 'total_currency' | 'owner' | 'slices'>;
```
This gives us a minimal type that is still **derived from the SDK** — so TypeScript catches any breaking API changes immediately.

## Environment Variables

| Variable | Description | Where used |
|---|---|---|
| `DUFFEL_API_TOKEN` | Your Duffel API key | Constructor: `new Duffel({ token })` |

## Important Notes for Beginners

1. **`total_amount` is always a string in Duffel.** Airlines return prices as strings (e.g. `"123.45"`). Our `parseFloat()` converts it to a number.
2. **The first slice's first segment is the "main" flight.** For display purposes, we always use `slices[0].segments[0]` for departure info and `slices[0].segments[last]` for arrival info. In a multi-segment (layover) journey, `segments[last]` gives the final landing.
3. **Correcting the Cabin Class field:**

   | Layer | What the code does | What's actually correct |
   |---|---|---|
   | **Wrong field** | Reads `fare_brand_name` for cabin class | Cabin class lives at `segments[n].passengers[n].cabin_class` |
   | **Wrong level** | `fare_brand_name` is on `OfferSlice` (a parent), not `OfferSliceSegment` | Our local type puts it on the segment, which doesn't match the SDK at all |
   | **Wrong type** | Local type declares it as `CabinClass` | In the SDK it's `string | null` — an airline brand name like `"BA Euro Traveller"` |

   **⚠️ Why `segments[0].passengers[0].cabin_class` won't compile right now:**
   `formatFlightResponse` casts to `DuffelFlightOffer` — the **local hand-written type** in `duffel-flights.types.ts`. That local type declares `segments` with only 6 fields (`departing_at`, `arriving_at`, `flight_number`, `origin`, `destination`, `fare_brand_name`). `passengers` is simply not listed there. TypeScript refuses to access a property that the type doesn't declare — even if the real API response contains it at runtime.

   **The fix requires two steps done in order:**

   **Step 1 — Switch to `Pick<Offer, ...>` (unlocks the SDK's full type chain):**
   ```typescript
   // In duffel-flights.types.ts — delete the hand-written DuffelFlightOffer interface
   // and replace with:
   import type { Offer } from '@duffel/api';
   export type DuffelFlightOffer = Pick<Offer, 'id' | 'total_amount' | 'total_currency' | 'owner' | 'slices'>;
   ```
   Now `slices` is `OfferSlice[]` (SDK type) → `segments` is `OfferSliceSegment[]` (SDK type) → `passengers` is `OfferSliceSegmentPassenger[]` (SDK type) → `cabin_class` is `CabinClass` (SDK enum — already correct).

   **Step 2 — Use the correct field (only works after Step 1):**
   ```typescript
   // In formatFlightResponse, replace line 103:
   cabinClass: flight.slices?.[0]?.segments?.[0]?.passengers?.[0]?.cabin_class,
   // No cast needed — it's already typed as CabinClass by the SDK
   ```

   Step 2 alone will fail with "Property 'passengers' does not exist" because the local type doesn't know about it. Step 1 must come first.
