# Providers Module — Sequence Diagrams

This document explains the flow of data through the Providers Module when a flight search request arrives.

---

## Full Flight Search Flow (Scatter-Gather)

When a user sends a `GET /flights` request, the system fans out to **all registered providers simultaneously**, collects what it can, and returns the merged result. This pattern is called **Scatter-Gather**.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Controller as FlightsController
    participant FlightSvc as FlightsService
    participant ExtAPI as FlightExternalApiService
    participant Cache as Redis Cache
    participant Duffel as DuffelFlightsAdapter
    participant FlightApi as FlightApiAdapter
    participant DuffelAPI as Duffel API (external)
    participant FlightApiIO as FlightAPI.io (external)

    User->>Controller: GET /flights?origin=LHR&destination=JFK&...
    Controller->>FlightSvc: search(query: FlightsSearchDto)
    FlightSvc->>ExtAPI: handle(query)

    ExtAPI->>Cache: get(cacheKey)
    alt Cache HIT
        Cache-->>ExtAPI: { data: Flight[], errors: [] }
        ExtAPI-->>FlightSvc: cached result
        FlightSvc-->>Controller: { data, errors }
        Controller-->>User: 200 JSON
    else Cache MISS
        Cache-->>ExtAPI: null

        note over ExtAPI, FlightApiIO: Promise.allSettled — runs ALL providers in parallel

        par Duffel Provider
            ExtAPI->>Duffel: searchFlights(query)
            Duffel->>DuffelAPI: offerRequests.create({ slices, passengers })
            DuffelAPI-->>Duffel: { data: { offers: Offer[] } }
            Duffel->>Duffel: offers.map(offer => formatFlightResponse(offer))
            Duffel-->>ExtAPI: Flight[]
        and FlightAPI Provider
            ExtAPI->>FlightApi: searchFlights(query)
            FlightApi->>FlightApi: buildUrl(query)
            FlightApi->>FlightApiIO: GET /oneway/{key}/{origin}/{dest}/{date}/...
            FlightApiIO-->>FlightApi: { itineraries, legs, carriers }
            FlightApi->>FlightApi: itineraries.map(i => formatFlightResponse({ i, legs, carriers }))
            FlightApi-->>ExtAPI: Flight[]
        end

        ExtAPI->>ExtAPI: Merge fulfilled results, collect errors
        ExtAPI->>Cache: set(cacheKey, { data, errors })
        ExtAPI-->>FlightSvc: { data: Flight[], errors: [] }
        FlightSvc-->>Controller: { data, errors }
        Controller-->>User: 200 JSON
    end
```

---

## Duffel Adapter: Internal Flow

This diagram shows what happens specifically inside the `DuffelFlightsAdapter` when it processes a search query.

```mermaid
sequenceDiagram
    autonumber
    participant ExtAPI as FlightExternalApiService
    participant Adapter as DuffelFlightsAdapter
    participant SDK as @duffel/api SDK
    participant DuffelAPI as Duffel REST API

    ExtAPI->>Adapter: searchFlights(query)

    note over Adapter: Build passengers array<br/>One { type: 'adult' } per query.adults_count

    note over Adapter: Build slices array<br/>Always: [{ origin, destination, departure_date }]<br/>If return_date: push second slice (reversed direction)

    Adapter->>SDK: offerRequests.create({ slices, passengers, return_offers: true })

    note over SDK, DuffelAPI: SDK handles auth, serialization, HTTP

    SDK->>DuffelAPI: POST /air/offer_requests?return_offers=true
    DuffelAPI-->>SDK: OfferRequest { offers: Offer[] }
    SDK-->>Adapter: DuffelResponse<OfferRequest>

    loop For each Offer in response
        Adapter->>Adapter: formatFlightResponse(offer)
        note over Adapter: Maps Duffel Offer → internal Flight<br/>slices[0].segments[0] → departure info<br/>slices[0].segments[last] → arrival info<br/>owner.name → airline<br/>total_amount → price (parsed to number)
    end

    Adapter-->>ExtAPI: Flight[]
```

---

## FlightAPI.io Adapter: Internal Flow

This diagram shows what happens inside the `FlightApiAdapter`.

```mermaid
sequenceDiagram
    autonumber
    participant ExtAPI as FlightExternalApiService
    participant Adapter as FlightApiAdapter
    participant Http as HttpService (Axios)
    participant FlightApiIO as FlightAPI.io REST API

    ExtAPI->>Adapter: searchFlights(query)
    Adapter->>Adapter: buildUrl(query)
    note over Adapter: Constructs URL path:<br/>{baseUrl}/{key}/{origin}/{dest}/{date}/{adults}/{children}/{infants}/{cabin}/{currency}

    Adapter->>Http: get(url)
    Http->>FlightApiIO: GET /oneway/...
    FlightApiIO-->>Http: { itineraries[], legs[], carriers[] }
    Http-->>Adapter: AxiosResponse

    Adapter->>Adapter: response.data as FlightapiResponse

    note over Adapter: Build lookup Maps for O(1) join:<br/>legsMap: Map<legId, Leg><br/>carriersMap: Map<carrierId, Carrier>

    loop For each Itinerary
        Adapter->>Adapter: formatFlightResponse({ itinerary, legs, carriers })
        note over Adapter: Join: itinerary.leg_ids[0] → leg<br/>Join: leg.carrier_ids[0] → carrier<br/>Map to internal Flight shape
    end

    Adapter-->>ExtAPI: Flight[]
```

---

## The Adapter Pattern: Side-by-Side Comparison

The two adapters implement the **same interface** but translate **completely different API shapes** into the same `Flight` output. This is the core value of the Adapter Pattern.

```mermaid
flowchart LR
    subgraph Input
        Q[FlightsSearchDto\norigin, destination,\ndeparture_date, adults_count ...]
    end

    subgraph DuffelPath ["Duffel Path"]
        D1["Build slices + passengers"]
        D2["SDK: offerRequests.create()"]
        D3["Response: Offer[] \n(nested: owner, slices → segments)"]
        D4["formatFlightResponse(offer)"]
    end

    subgraph FlightApiPath ["FlightAPI Path"]
        F1["Build URL path string"]
        F2["HttpService.get(url)"]
        F3["Response: itineraries[] + legs[] + carriers[]\n(joined by ID references)"]
        F4["formatFlightResponse({ itinerary, legs, carriers })"]
    end

    subgraph Output
        R["Flight[]\nid, source, airline,\nflightNumber, departureAirport,\narrivalAirport, departureTime,\narrivalTime, price, currency"]
    end

    Q --> D1 --> D2 --> D3 --> D4 --> R
    Q --> F1 --> F2 --> F3 --> F4 --> R
```

---

## Error Handling Comparison

Both adapters handle errors, but the error shapes from the two providers are completely different.

| Scenario | Duffel | FlightAPI.io |
|---|---|---|
| **Bad API key / Unauthorized** | SDK throws with `error.errors[0].message` | Axios response with `status: 401` |
| **Generic failure** | Standard JS `Error.message` | Standard JS `Error.message` |
| **NestJS exception thrown** | `UnauthorizedException` or `BadRequestException` | `UnauthorizedException` or `BadRequestException` |

Both adapters wrap all errors in NestJS HTTP exceptions so that the `FlightExternalApiService` can catch them uniformly via `Promise.allSettled()`. A provider failure never crashes the whole request — it gets recorded in the `errors[]` array and returned alongside any successful results from other providers.
