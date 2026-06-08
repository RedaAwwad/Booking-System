# FlightAPI.io Provider

## What is FlightAPI.io?

[FlightAPI.io](https://flightapi.io) is a simple REST-based flight data aggregator. Unlike Duffel, there is no SDK — you just call a URL with your API key and search parameters embedded in the path, and receive JSON back.

## How Requests Are Made (`flightapi.adapter.ts`)

This adapter uses NestJS's `HttpService` (a wrapper around Axios) to make HTTP requests. The call is wrapped in `firstValueFrom()` because `HttpService.get()` returns an **RxJS Observable**, not a native `Promise`. `firstValueFrom()` converts it:

```typescript
import { firstValueFrom } from 'rxjs';

const response = await firstValueFrom(this.httpService.get(url));
```

> **Why RxJS?** `HttpService` is built on top of Angular's `HttpClient` heritage and uses observables by convention. For simple one-off requests, `firstValueFrom()` is the standard way to convert to a Promise.

## URL Structure

All search parameters are embedded in the URL path:

```
{BASE_URL}/{API_KEY}/{origin}/{destination}/{departure_date}/{adults}/{children}/{infants}/{cabin}/{currency}
```

Example:
```
https://api.flightapi.io/oneway/YOUR_KEY_HERE/LHR/JFK/2026-06-30/1/0/0/Economy/USD
```

The `buildUrl()` method assembles this string. Note:
- `infants` is always `0` (FlightAPI.io requires the field but the search DTO doesn't include it).
- `cabin` is mapped from our `CabinClass` enum to FlightAPI.io's capitalized string.

## Understanding the Response Format

FlightAPI.io returns a **denormalized, relational-style response** — not a simple list of flight objects. The response has three arrays that are joined by ID references:

```json
{
  "itineraries": [
    {
      "id": "itin-abc",
      "leg_ids": ["leg-123"],
      "pricing_options": [{ "price": { "amount": 450, "currency": "USD" } }]
    }
  ],
  "legs": [
    {
      "id": "leg-123",
      "departure_airport_code": "LHR",
      "arrival_airport_code": "JFK",
      "departure_time": "2026-06-30T10:00:00",
      "arrival_time": "2026-06-30T13:00:00",
      "carrier_ids": ["carrier-456"],
      "segments": [{ "flight_number": "BA117", "cabin_class": "Economy" }]
    }
  ],
  "carriers": [
    { "id": "carrier-456", "name": "British Airways", "iata": "BA" }
  ]
}
```

To get a complete picture of one itinerary, you must:
1. Take an itinerary → look up its `leg_ids[0]` in the `legs` array
2. Take that leg → look up its `carrier_ids[0]` in the `carriers` array

The adapter uses `Map` objects for efficient lookup:
```typescript
const legsMap     = new Map<string, FlightapiLeg>();
const carriersMap = new Map<string, FlightapiCarrier>();
```
This avoids repeated `.find()` calls (O(n²)) and performs the join in O(n).

## Local Types (`flightapi.types.ts`)

All local types are fully defined (no SDK dependency):

| Type | Description |
|---|---|
| `FlightapiResponse` | Root response object with `itineraries`, `legs`, `carriers` |
| `FlightapiItinerary` | One flight option, with references to leg IDs and pricing |
| `FlightapiLeg` | One physical journey leg with times, airports, and carrier references |
| `FlightapiCarrier` | An airline with name and IATA code |
| `FlightapiError` | Error response shape with `response.status` for HTTP status checks |

## Environment Variables

| Variable | Description | Where used |
|---|---|---|
| `FLIGHTAPI_API_KEY` | Your FlightAPI.io API key | Embedded in URL path |
| `FLIGHTAPI_API_URL` | Base URL of the FlightAPI.io endpoint | Start of URL path |

## Important Notes for Beginners

1. **`cabin_class` in FlightAPI.io is a plain `string`**, not our `CabinClass` enum. The cast `as unknown as CabinClass` is a workaround — a proper mapper function would be safer.
2. **`infants` is hardcoded to `0`** because `FlightsSearchDto` doesn't have an infants field. This is a product gap — the API supports infants but we don't expose that option yet.
3. **The `filter((f): f is Flight => f !== null)` is a type guard.** Since `formatFlightResponse` always returns a `Flight` and never returns `null`, this filter is defensive but harmless. It also serves as a TypeScript type narrowing hint.
4. **Children count comes from `query.children_count || 0`**. The `|| 0` ensures that if `children_count` is `undefined` (it's optional in the DTO), it defaults to 0.
