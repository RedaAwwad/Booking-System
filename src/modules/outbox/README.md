# Outbox Module

## Overview
The **Outbox Module** is a critical component for maintaining data consistency across the distributed system. It implements the **Transactional Outbox Pattern**, ensuring that asynchronous events (like sending a notification email) are guaranteed to be published to the message broker (RabbitMQ) only if the corresponding database transaction successfully commits.

## Architecture

This pattern avoids the common pitfall of a "Dual Write" (writing to the database and publishing to RabbitMQ simultaneously) which can lead to inconsistencies if one fails.

1. **Write Phase (`OutboxService`)**: When a booking is created, an event is saved to the `outbox_messages` table within the same PostgreSQL transaction.
2. **Notification Phase (Database Trigger)**: A PostgreSQL trigger issues a `pg_notify` command on the `outbox_channel` whenever a new row is inserted into the outbox table.
3. **Listen Phase (`EventDispatcherService`)**: This service maintains a persistent connection to the database, executing `LISTEN outbox_channel`. It receives the notification in real-time.
4. **Publish Phase (`PublisherService`)**: Upon receiving the notification, the message payload is sent to RabbitMQ, and the row in the database is marked as `PROCESSED`.

## Key Components

### `OutboxService`
Located in `outbox.service.ts`.
- **`writeEvent(entityManager, eventData)`**: Accepts a TypeORM EntityManager and an event payload. It persists the event to the `outbox_messages` table. This method *must* be called within an active transaction to guarantee atomicity.

### `EventDispatcherService`
Located in `event-dispatcher.service.ts`.
- Implements `OnModuleInit` to establish a dedicated raw database connection.
- Executes `LISTEN outbox_channel` and attaches a listener to the `notification` event on the `pg.Client`.
- Automatically polls and processes any pending messages ("bootstrap messages") that may have been missed if the server crashed.

### `PublisherService`
Located in `publisher.service.ts`.
- **`publishRecord(record)`**: Responsible for taking an outbox database record, extracting the payload, publishing it to RabbitMQ using the configured exchange and routing key, and updating the record status to `PROCESSED`.

## Dependencies
- **PostgreSQL**: Relies on specific PostgreSQL features (`LISTEN/NOTIFY`).
- **RabbitMQ**: The underlying message broker used to route these outbox events to their respective consumers (like the Notifications module).
