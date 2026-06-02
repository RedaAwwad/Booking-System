# External API Module

## Overview
The **External API Module** acts as an aggregator and intermediary between the core business modules (Flights, Hotels) and the actual 3rd-party integration logic (Providers Module).

## Purpose
Instead of the `FlightsService` knowing about Duffel, Amadeus, or Skyscanner individually, it simply calls the `FlightExternalApiService`. This service:
1. Gathers instances of all registered flight providers.
2. Executes the search against all of them, often in parallel.
3. Aggregates and normalizes the results.
4. Handles timeout errors or partial failures gracefully so the user still receives available results.

## Key Components

### `FlightExternalApiService`
- Injected with multiple concrete provider services (e.g., `DuffelFlightProvider`).
- **`handle(query)`**: Dispatches the search to all providers, aggregates the data into a standard `Flight[]` array, and returns it along with a list of any provider-specific errors.

### `HotelExternalApiService`
- Functions identically to the flight counterpart but tailored for hotel searches.

## Design Pattern
This module heavily utilizes the **Strategy Pattern** combined with **Facade**. It hides the complexity of talking to multiple distinct external APIs behind a unified interface, ensuring that the main controllers and services remain clean and provider-agnostic.
