# Transactions Module

## Overview
The **Transactions Module** provides a unified ledger for all financial interactions within the Booking System. Whether a user is booking a flight, a hotel, or a bundled package, the activity always stems from a central `Transaction` entity.

## Key Concepts

### Centralized Ledger
By creating a generic transaction record *before* inserting domain-specific records (like a `FlightBooking` or `HotelBooking`), the system ensures:
- **Auditability**: All monetary flows can be tracked in one place.
- **Foreign Key Stability**: The flight and hotel bookings reference this transaction, tying complex operations back to a single overarching identifier.

## Components

### `TransactionsService`
Located in `transactions.service.ts`.
- **`createWithEntityManager(entityManager, dto)`**: The primary method used by other domains (Flights, Hotels) to generate a transaction. It accepts a TypeORM `EntityManager` so that it can participate in an existing database transaction, ensuring atomicity.

## Data Structures
- **Entities (`entities/`)**: Contains the `Transaction` TypeORM entity, which maps to the `transactions` database table. It typically stores the amount, currency, status (`PENDING`, `COMPLETED`, `FAILED`), and payment method.

## Usage in Other Modules
When the `FlightsModule` processes a booking:
1. It starts a TypeORM transaction.
2. It calls `TransactionsService.createWithEntityManager(...)` to get a transaction ID.
3. It inserts the flight details referencing that transaction ID.
4. It inserts an Outbox event.
5. The transaction commits.
