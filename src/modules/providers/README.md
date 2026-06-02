# Providers Module

## Overview
The **Providers Module** contains the concrete implementations for connecting to external 3rd-party services. This is where actual HTTP requests are constructed and sent out over the network.

## Key Concepts

### Provider Interfaces
All providers implement a common interface (e.g., `FlightProviderInterface`). This ensures that the `External API Module` can interact with any provider uniformly without knowing its underlying specific details.

### Implementation Examples
- **`DuffelFlightProvider`**: Utilizes the `@duffel/api` SDK or direct HTTP calls to fetch flight data from the Duffel platform. It takes the internal `FlightsSearchDto`, translates it into the format Duffel expects, executes the request, and maps the response back to the internal `Flight` entity.
- **Other Providers**: As the business scales, additional providers (like Amadeus, Skyscanner, or Expedia) will be placed in this module.

## Cache Integration
The provider classes often integrate with the `Cache Module`. When a search is requested:
1. The provider checks if the exact search query exists in Redis.
2. If yes, it returns the cached data instantly (Cache Hit).
3. If no, it performs the network request, normalizes the data, stores it in Redis (Cache Miss), and then returns it.

## Error Handling
Providers are responsible for catching HTTP exceptions (using `Axios` or Nest's `HttpService`) and formatting them gracefully so they do not crash the aggregating `External API Module`.
