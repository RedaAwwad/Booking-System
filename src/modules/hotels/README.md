# Hotels Module

## Overview
The **Hotels Module** mirrors the functionality of the Flights module but is tailored for hotel reservations. It exposes API endpoints for searching available hotel rooms across various providers and initiating the booking flow.

## Key Components

### `HotelsController`
- **`GET /hotels`**: Accepts query parameters (e.g., location, dates, guests) and returns matching hotel options by communicating with the underlying services.
- **`POST /hotels`**: Initiates a hotel booking, handling payload validation via DTOs.

### `HotelsService`
Contains the business logic for hotels:
- **`search(query)`**: Relies on the `HotelExternalApiService` (part of the External API module) to fetch real-time availability from third-party APIs.
- **`createBooking(dto)`**: Orchestrates the persistence of the hotel booking. Similar to flights, this step involves a robust transaction strategy:
  1. Registering the transaction in the `transactions` table.
  2. Saving the booking details in the `hotel_bookings` table.
  3. Generating an outbox event to dispatch an email notification to the user asynchronously.

## Data Structures
- **DTOs (`dto/`)**: Data Transfer Objects representing the expected shape of requests (e.g., `HotelsSearchDto`, `CreateHotelBookingDto`).
- **Entities (`entities/`)**: TypeORM entities defining the database schema for hotel bookings.
- **Types (`hotels.types.ts`)**: TypeScript definitions for internal data structures (e.g., `HotelRoom`).

## Dependencies
- **`ExternalAPI Module`**: For abstracting the calls to third-party hotel systems.
- **`Transactions Module`**: For creating unified financial tracking records.
- **`Outbox Module`**: For reliably capturing events (like confirmations) intended for message brokers.
