# Booking System - Project Documentation

## Overview
This is a NestJS-based booking system designed to handle flight and hotel searches and reservations. The application relies on multiple external providers to fetch data and uses an event-driven architecture to ensure data consistency and reliability across different components.

## Architecture & Technology Stack
- **Framework:** NestJS
- **Database:** PostgreSQL with TypeORM
- **Caching:** Redis (via `cache-manager` and `cache-manager-redis-yet`)
- **Messaging/Eventing:** RabbitMQ (via `rabbitmq-client`)
- **Reliability Pattern:** Transactional Outbox Pattern using PostgreSQL `LISTEN/NOTIFY`
- **API Documentation:** Swagger (`/api-docs`)

## Key Patterns
### Transactional Outbox
To ensure that an external system (like RabbitMQ) receives messages only if the corresponding database transaction is successfully committed, this project implements the **Transactional Outbox** pattern.

1. When a transaction occurs (e.g., creating a booking), an event is written to the `outbox_messages` table within the **same** database transaction.
2. PostgreSQL triggers a `NOTIFY` event using `pg_notify` on a specific channel (`outbox_channel`).
3. The `EventDispatcherService` listens for these events via `LISTEN outbox_channel`.
4. Once picked up, the `PublisherService` securely publishes the message to RabbitMQ and marks the outbox record as `PROCESSED`.

## Modules Overview
The codebase is structured modularly. Detailed documentation can be found inside each module's respective directory:

### Business Modules (`src/modules/`)
- **[Flights Module](./modules/flights/README.md):** Handles searching and booking flights.
- **[Hotels Module](./modules/hotels/README.md):** Handles searching and booking hotels.
- **[Transactions Module](./modules/transactions/README.md):** Manages internal payment and tracking records for bookings.
- **[Outbox Module](./modules/outbox/README.md):** Contains the core logic for the transactional outbox pattern.
- **[Notifications Module](./modules/notifications/README.md):** Consumes RabbitMQ events to send out transactional emails to users.
- **[External API Module](./modules/external-api/README.md):** The unified interface for sending requests to 3rd-party aggregators.
- **[Providers Module](./modules/providers/README.md):** The specific implementations for third-party systems like Duffel.

### Shared Infrastructure (`src/common/`)
- **[Database Module](./common/database/README.md):** Sets up the PostgreSQL connection and TypeORM logic.
- **[Cache Module](./common/cache/README.md):** Configures Redis to cache provider responses and speed up searches.
- **[Sanitize Module](./common/sanitize/README.md):** Implements security mechanisms (e.g., `SanitizePipe`) to prevent XSS attacks across all endpoints.

## Getting Started
The server usually runs on port 3000 (configurable via `.env`).
Swagger documentation is automatically hosted at `http://localhost:3000/api-docs`.
