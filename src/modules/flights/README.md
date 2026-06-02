# Flights Module

## Overview
The **Flights Module** is responsible for exposing API endpoints to search for and book flights. It acts as an orchestrator that validates incoming requests, delegates the actual provider searching to the `External API Module`, coordinates internal transaction records, and triggers events for notifications.

## Key Components

### `FlightsController`
Located in `flights.controller.ts`.
- **`GET /flights`**: Searches for flights based on criteria (origin, destination, dates, etc.) defined in `FlightsSearchDto`.
- **`POST /flights`**: Creates a flight booking using details in `CreateFlightBookingDto`.

### `FlightsService`
Located in `flights.service.ts`.
Contains the core business logic:
- **`search(query)`**: Simply passes the request down to the `FlightExternalApiService` to handle parallel requests to third-party providers.
- **`createBooking(dto)`**: Handles the multi-step booking process inside a **database transaction**:
  1. Creates a pending transaction record via `TransactionsService`.
  2. Saves the `FlightBooking` entity to the database.
  3. Uses `OutboxService` to write an event to the `outbox_messages` table, notifying the system to send an email confirmation to the user.

## Data Structures
- **DTOs (`dto/`)**: Input validation structures for searching (`FlightsSearchDto`) and booking (`CreateFlightBookingDto`).
- **Entities (`entities/`)**: TypeORM entities, specifically `FlightBooking` which maps to the database table for flight bookings.
- **Types (`flights.types.ts`)**: TypeScript interfaces outlining the domain objects (e.g., `Flight`).

## Dependencies
- **`ExternalAPI Module`**: For dispatching search requests.
- **`Transactions Module`**: For persisting the financial state of a booking.
- **`Outbox Module`**: For reliably publishing notification events asynchronously.
