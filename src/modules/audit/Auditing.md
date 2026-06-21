
## Building Auditing with RabbitMQ — Step‑by‑Step Plan

You want to use RabbitMQ for auditing in your booking system. This is a solid choice if you plan to evolve into microservices later, but for now, it will teach you message‑based architectures while keeping your code clean. Here’s how to do it, step by step, without writing any code for you.

---

### Step 1: Understand Why RabbitMQ for Auditing

Auditing is a **side effect** — it should never block the main business operation. By sending audit events to RabbitMQ, you:

- **Decouple** the core services from the audit storage. Booking, payment, and user modules just publish messages and forget.
- **Guarantee delivery** — RabbitMQ persists messages to disk, so even if the audit consumer is down, no audit event is lost.
- **Handle load spikes** — if many events happen at once, the queue buffers them.
- **Prepare for the future** — when you split into microservices, the same messaging infrastructure can be reused.

**Note:** For a learning project, this adds more infrastructure than strictly necessary (a local NestJS `EventEmitter` would suffice), but it’s an excellent way to learn messaging patterns. Keep both RabbitMQ and PostgreSQL running in Docker for convenience.

---

### Step 2: Set Up RabbitMQ (Infrastructure)

1. **Run RabbitMQ** using Docker Compose alongside your PostgreSQL container.
2. Expose the management UI (port `15672`) so you can monitor queues.
3. In your NestJS app, install the official RabbitMQ client library (`@golevelup/nestjs-rabbitmq`) or the NestJS microservices RabbitMQ transport. For a straightforward pub/sub audit, `@golevelup/nestjs-rabbitmq` is more flexible and recommended.
4. **Configure the connection** in your NestJS app (in `app.module.ts` or a dedicated `rabbitmq.module.ts`). You’ll need the host, port, username, password, and a virtual host (default `'/'`). These values come from your `.env` file.

---

### Step 3: Design Your Audit Event Messages

Define a standard message structure that every producer will send. A good audit event contains:

- `eventType` (e.g., `'booking.created'`, `'payment.captured'`)
- `entityType` (`'BOOKING'`, `'TRANSACTION'`, etc.)
- `entityId` (booking ID, order ID, etc.)
- `action` (a human‑readable verb: `'CREATED'`, `'STATUS_CHANGED'`)
- `oldValue` and `newValue` (JSON snapshots)
- `performedBy` (user ID or `'SYSTEM'`, `'WEBHOOK'`, `'CRON'`)
- `metadata` (any extra context, like the error message on failure)
- `timestamp` (when the event was generated on the producer side)
- `correlationId` (a unique ID for this event, used for deduplication in the consumer)

**Why a standard schema?** The consumer will process all events in the same way and write to the same `audit_logs` table, regardless of source. You can also add fields later without breaking existing producers if you use versioned schemas.

---

### Step 4: Create the RabbitMQ Module (Infrastructure Code)

Build a `RabbitMQModule` (e.g., `src/rabbitmq/rabbitmq.module.ts`) that:

- Imports the `RabbitMQModule` from `@golevelup/nestjs-rabbitmq` with the connection configuration.
- Exports the module so it can be used by feature modules.

Alternatively, make a global shared module that provides a custom `AmqpConnection` wrapper for publishing messages.

---

### Step 5: Define Exchanges, Queues, and Bindings

You need an **exchange** (topic exchange recommended) and a **queue** for auditing.

1. **Exchange name**: `audit.exchange` (or `booking.events` – you can use a single exchange for all events if you also do other things with RabbitMQ).
2. **Queue name**: `audit.queue`.
3. **Routing keys**: Use a pattern like `audit.#` to route all audit events to the queue. Or more granular: `audit.booking.*`, `audit.payment.*`, etc.
4. **Bind the queue** to the exchange with the appropriate routing key.

Configure these in the `RabbitMQModule` or in a separate file using the module’s `exchanges` and `queues` setup. For audit, a durable exchange and durable queue are essential — you don’t want to lose messages if the broker restarts.

---

### Step 6: Create an Audit Producer (Publisher) Service

Instead of having every service directly use `AmqpConnection`, create a dedicated `AuditPublisher` service that encapsulates the message publishing.

**What it does:**
- Takes an audit event object (with the schema from Step 3).
- Adds a unique `correlationId` (UUID) and the `timestamp` if not already present.
- Publishes the message to the audit exchange with routing key (e.g., `audit.booking.created`).

**Where to call it:**
- Inside your services (BookingService, PaymentService, etc.) after the business logic succeeds.
- Never call it inside a database transaction unless you handle rollbacks carefully — the message should be published only after the DB change is committed to avoid ghost events.

---

### Step 7: Integrate the Publisher into Your Business Modules

Now, modify your existing services to publish audit events at key moments.

**Booking module:**
- After a booking is created: publish `'booking.created'` with booking details.
- After a booking is confirmed/cancelled: publish `'booking.status_changed'` with old and new status.

**Payment module:**
- After a transaction is created: publish `'transaction.created'`.
- After a payment attempt is stored and the provider call succeeds: publish `'payment.initiated'`.
- After capture succeeds or fails: publish `'payment.captured'` or `'payment.failed'`.
- In the webhook handler: publish `'payment.webhook_received'` with the outcome.
- In the stale cleanup cron job: publish `'transaction.canceled'` for each stale order.

**Important:** Ensure idempotency — if a duplicate request arrives, the service should still publish the same event? Better: only publish when a new state is actually created. In the payment service, for example, if the idempotency check returns an existing attempt, do not publish again (because the event was already sent during the first attempt).

---

### Step 8: Build the Audit Consumer

This is the subscriber that receives messages from the `audit.queue` and writes them to the database.

**Create a new service** (e.g., `AuditConsumerService`) that:

- Uses the `@RabbitRPC` or `@RabbitHandler` decorator from `@golevelup/nestjs-rabbitmq` to listen to the queue.
- On message arrival, extracts the data, transforms it if necessary, and calls the `AuditService` (the one that writes to the `audit_logs` table).
- Handles **deduplication**: before inserting, check if an audit log with the same `correlationId` already exists. If yes, acknowledge the message and do nothing (prevents duplicate entries if message is redelivered).
- On any other error (database down, etc.), reject/nack the message so it goes to a dead‑letter queue for later retry. This ensures you don’t silently lose audit data.

**Deduplication approach:**
- Add a `correlationId` column (unique) to your `audit_logs` table. The consumer tries to insert. If a unique constraint violation occurs, catch it and ack the message.

**Ack/Nack strategy:**
- Use manual acknowledgement mode. After successful DB write, ack the message.
- If the database is unreachable, nack with requeue=false (so it goes to DLQ, not infinite retry).

---

### Step 9: Set Up Dead‑Letter Queues

For robust handling of failing messages:

1. Define a **dead‑letter exchange** (e.g., `audit.dlx`) and a **dead‑letter queue** (`audit.dlq`).
2. Configure your `audit.queue` with `x-dead-letter-exchange` and `x-dead-letter-routing-key` so that rejected messages end up in the DLQ.
3. You can later monitor the DLQ manually or build a small admin panel to inspect and replay messages if the issue was temporary (like a DB outage).

---

### Step 10: Database Schema for Audit Logs

Your `audit_logs` table needs:

- A primary key (UUID or auto‑increment ID).
- All the fields from the message schema, plus a `correlationId` with a unique constraint.
- Indexes on `entityType`, `entityId`, `createdAt` for efficient querying.

Because messages arrive as JSON, you can store `oldValue` and `newValue` as `jsonb` in PostgreSQL.

---

### Step 11: Testing the Flow End to End

1. Start RabbitMQ (and PostgreSQL) via Docker.
2. Start your NestJS app.
3. Trigger a payment init via the API.
4. Check the RabbitMQ management UI: you should see a message in the `audit.queue`, processed, and the consumer count increment.
5. Check the `audit_logs` table: the event should be there with `correlationId` filled.
6. Simulate a consumer failure (stop the database) and send another event — the message should end up in the dead‑letter queue after failing the maximum retries.
7. Restore the DB and manually publish the message from DLQ to verify it’s processed.

---

### Step 12: Monitoring and Observability

- Use the RabbitMQ management UI to watch queue depths, consumer activity, and message rates.
- Log any errors in the consumer using NestJS’s `Logger`.
- For production, you’d add metrics (Prometheus) and alerts on DLQ growth, but for learning, the UI is enough.
