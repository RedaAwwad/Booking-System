# Audit Module — RabbitMQ Implementation Plan (v2)

Migrate the audit module from a direct `EntityManager` write to a **RabbitMQ pub/sub architecture
routed through the existing transactional outbox**, giving audit the same reliability and retry
guarantees as notifications — with no new infrastructure.

---

## Core Architecture Decision

Audit events go through the **existing outbox**, not a separate direct publisher:

```
dataSource.transaction():
  ├── em.save(FlightBooking)               ← business data
  ├── outboxService.writeEvent(em, notif)  ← notification row  ┐ committed
  └── outboxService.writeEvent(em, audit)  ← audit row         ┘ atomically

pg_notify trigger fires → EventDispatcherService
  → PublisherService.publishRecord(row)
      ├── exchange: booking.notifications  →  NotificationWorkerService  → notifications table
      └── exchange: audit.exchange         →  AuditConsumerService       → audit_logs table

pg_cron every 5 min: re-fires READY rows   ← safety net for both
```

**Why this is better than a separate `AuditPublisherService`:**

| Concern | Direct publish (v1 plan) | Through outbox (this plan) |
|---|---|---|
| Survives RabbitMQ outage at publish time | ❌ event lost | ✅ row stays READY, retried |
| Survives app crash after DB commit | ❌ event lost | ✅ pg_cron replays it |
| Audit rolls back if booking fails | ❌ (published after tx) | ✅ (inside same tx) |
| New infrastructure required | New publisher service | None — reuse existing |
| Type safety | needs fixing | fixed in `OutboxService` |

---

## Proposed Changes

### 1. Environment & Configuration

#### [MODIFY] [.env.example](file:///d:/Mentorship/Booking/Project/Booking-System/.env.example)

Add audit-specific routing variables under the existing `# RabbitMQ` block:

```diff
 RABBITMQ_URL=amqp://booking:booking@localhost:5672/
+
+# Outbox routing keys — used by OutboxService callers and their consumers
+NOTIFICATIONS_EXCHANGE=booking.notifications
+NOTIFICATIONS_ROUTING_KEY=email.notifications
+AUDIT_EXCHANGE=audit.exchange
+AUDIT_QUEUE=audit.queue
+AUDIT_ROUTING_KEY=audit.events
```

> [!NOTE]
> `NOTIFICATIONS_EXCHANGE` and `NOTIFICATIONS_ROUTING_KEY` are new env vars for existing
> notification routing, which is currently hardcoded as magic strings in call sites.
> This is fixed as part of this plan for consistency.

---

### 2. Outbox Module — Type Safety Fix

The `payload: any` type in `OutboxService` and `OutboxMessage` is fixed by introducing a
**discriminated union** of all valid outbox payloads. This eliminates every `any` in the outbox path.

#### [NEW] `src/modules/outbox/types/outbox-payload.type.ts`

```typescript
import { AuditAction } from '../../audit/audit-action.enum';

// ── Notification payload ────────────────────────────────────────────────────
export interface NotificationPayload {
  kind: 'notification';
  transactionId: string;
  type: 'EMAIL' | 'SMS';
  recipient: string;
  subject?: string;
  content: string;
}

// ── Audit payload ───────────────────────────────────────────────────────────
export interface AuditPayload {
  kind: 'audit';
  eventType: string;             // e.g. 'booking.created'
  entityType: string;            // e.g. 'FlightBooking'
  entityId: string;
  action: AuditAction;
  performedBy: string;           // userId, 'SYSTEM', 'WEBHOOK', 'CRON'
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlationId: string;         // UUID — dedup key in the consumer
  timestamp: string;             // ISO 8601 — producer wall-clock time
}

// ── Union ───────────────────────────────────────────────────────────────────
export type OutboxPayload = NotificationPayload | AuditPayload;
```

The `kind` discriminant lets both the outbox entity and each consumer switch on the exact shape.

---

#### [MODIFY] [outbox-message.entity.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/entities/outbox-message.entity.ts)

Replace `payload: any` with the union type:

```diff
-import { ... } from 'typeorm';
+import { ... } from 'typeorm';
+import { OutboxPayload } from '../types/outbox-payload.type';

 @Column({ type: 'jsonb' })
-payload: any;
+payload: OutboxPayload;
```

---

#### [MODIFY] [outbox.service.ts](file:///d:/Mentorship\Booking\Project\Booking-System\src\modules\outbox\outbox.service.ts)

Replace the `payload: any` in the input signature:

```diff
+import { OutboxPayload } from './types/outbox-payload.type';

 writeEvent(
   em: EntityManager,
   input: {
     exchangeName: string;
     routingKey: string;
-    payload: any;
+    payload: OutboxPayload;
   },
 ): Promise<OutboxMessage> {
```

---

#### [MODIFY] [publisher.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/publisher.service.ts)

`record.payload` is now `OutboxPayload` — the `publisher.send()` call is already correct since
`rabbitmq-client` accepts any serialisable value. No functional change, just the type flows through.

---

### 3. Notification Worker — Fix Magic Strings & `any`

#### [MODIFY] [notification-worker.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications/worker/notification-worker.service.ts)

Two changes:

1. Read exchange/queue/routing key from `ConfigService` instead of hardcoded strings:
```diff
-queue: 'email.notifications',
-exchanges: [{ exchange: 'booking.notifications', type: 'direct' }],
-queueBindings: [{ exchange: 'booking.notifications', routingKey: 'email.notifications' }],
+queue: this.configService.getOrThrow<string>('NOTIFICATIONS_ROUTING_KEY'),
+exchanges: [{ exchange: this.configService.getOrThrow<string>('NOTIFICATIONS_EXCHANGE'), type: 'direct' }],
+queueBindings: [{ exchange: ..., routingKey: this.configService.getOrThrow<string>('NOTIFICATIONS_ROUTING_KEY') }],
```

2. Type `msg.body` as `NotificationPayload` (narrowed from the union):
```diff
-private async handleNotification(payload: any) {
+private async handleNotification(payload: NotificationPayload) {
```

---

### 4. Call-Site Changes in Business Services

The two `writeEvent()` calls in each service change from magic strings to `ConfigService` values,
and the audit `writeLog()` call is **replaced** by a second `writeEvent()` call.

#### [MODIFY] [flights.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/flights/flights.service.ts)

```diff
-import { AUDIT_SERVICE } from '../audit/audit.interface';
-import type { IAuditService } from '../audit/audit.interface';
+import { randomUUID } from 'crypto';
+import { AuditPayload } from '../outbox/types/outbox-payload.type';

 constructor(
   ...
-  @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
+  private readonly configService: ConfigService,
 ) {}

 // Inside createBooking → dataSource.transaction():

-// Step 3 (old) — direct DB write inside tx
-await this.auditService.writeLog(em, {
-  userId: dto.userId,
-  action: AuditAction.FLIGHT_BOOKING_CREATED,
-  entityName: 'FlightBooking',
-  entityId: flightBooking.id,
-});

-// Step 4 (old) — notification with magic strings
-await this.outboxService.writeEvent(em, {
-  exchangeName: 'booking.notifications',
-  routingKey: 'email.notifications',
-  payload: { ... },
-});

+// Step 3 — notification outbox event (env-configured)
+await this.outboxService.writeEvent(em, {
+  exchangeName: this.configService.getOrThrow('NOTIFICATIONS_EXCHANGE'),
+  routingKey:   this.configService.getOrThrow('NOTIFICATIONS_ROUTING_KEY'),
+  payload: {
+    kind: 'notification',
+    transactionId: transaction.id,
+    type: 'EMAIL',
+    recipient: dto.userEmail,
+    subject: `Flight booking confirmation (${dto.origin} → ${dto.destination})`,
+    content: 'Your flight booking is confirmed.',
+  } satisfies NotificationPayload,
+});

+// Step 4 — audit outbox event (env-configured, same outbox, different exchange)
+await this.outboxService.writeEvent(em, {
+  exchangeName: this.configService.getOrThrow('AUDIT_EXCHANGE'),
+  routingKey:   this.configService.getOrThrow('AUDIT_ROUTING_KEY'),
+  payload: {
+    kind: 'audit',
+    eventType:    'booking.created',
+    entityType:   'FlightBooking',
+    entityId:     flightBooking.id,
+    action:       AuditAction.FLIGHT_BOOKING_CREATED,
+    performedBy:  dto.userId,
+    newValue:     { origin: dto.origin, destination: dto.destination, totalPrice: dto.totalPrice },
+    correlationId: randomUUID(),
+    timestamp:    new Date().toISOString(),
+  } satisfies AuditPayload,
+});
```

#### [MODIFY] [hotels.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/hotels/hotels.service.ts)

Same structural change — replace `auditService.writeLog()` + magic-string `writeEvent()` with two
typed `writeEvent()` calls using `satisfies`.

---

### 5. Audit Module — Slim Down to Consumer Only

The `AuditService`, `IAuditService`, and `AUDIT_SERVICE` token are **deleted**. The module now only
owns the consumer and the entity.

#### [DELETE] `src/modules/audit/audit.service.ts`
#### [DELETE] `src/modules/audit/audit.interface.ts`

---

#### [MODIFY] [audit-log.entity.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/entities/audit-log.entity.ts)

Replace the lean schema with the full event schema:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | existing |
| `correlation_id` | `varchar(36)` UNIQUE NOT NULL | dedup key |
| `event_type` | `varchar(100)` NOT NULL | e.g. `'booking.created'` |
| `entity_type` | `varchar(100)` NOT NULL | e.g. `'FlightBooking'` |
| `entity_id` | `varchar(255)` nullable | existing |
| `action` | `varchar(50)` NOT NULL | existing |
| `performed_by` | `varchar(255)` NOT NULL | userId or `'SYSTEM'` etc. |
| `old_value` | `jsonb` nullable | snapshot before change |
| `new_value` | `jsonb` nullable | snapshot after change |
| `metadata` | `jsonb` nullable | extra context |
| `event_timestamp` | `timestamp` NOT NULL | producer wall-clock |
| `created_at` | `timestamp` NOT NULL | consumer insert time |

> [!NOTE]
> `user_id` is replaced by `performed_by varchar` to support non-user actors (`'SYSTEM'`, `'CRON'`,
> `'WEBHOOK'`). Indexes added on `(entity_type, entity_id)` and `created_at`.

---

#### [NEW] `src/modules/audit/audit-consumer.service.ts`

Mirrors `NotificationWorkerService` exactly, but reads from the audit queue:

```typescript
@Injectable()
export class AuditConsumerService implements OnModuleInit, OnModuleDestroy {
  onModuleInit() {
    const exchange   = this.configService.getOrThrow<string>('AUDIT_EXCHANGE');
    const queue      = this.configService.getOrThrow<string>('AUDIT_QUEUE');
    const routingKey = this.configService.getOrThrow<string>('AUDIT_ROUTING_KEY');

    this.consumer = this.connection.createConsumer(
      {
        queue,
        queueOptions: { durable: true },
        qos: { prefetchCount: 10 },
        exchanges: [{ exchange, type: 'topic' }],
        queueBindings: [{ exchange, routingKey }],
      },
      async (msg) => {
        const payload = msg.body as AuditPayload;  // typed, no any
        await this.handleAuditEvent(payload);
      },
    );
  }

  private async handleAuditEvent(payload: AuditPayload): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        correlationId:   payload.correlationId,
        eventType:       payload.eventType,
        entityType:      payload.entityType,
        entityId:        payload.entityId,
        action:          payload.action,
        performedBy:     payload.performedBy,
        oldValue:        payload.oldValue  ?? null,
        newValue:        payload.newValue  ?? null,
        metadata:        payload.metadata  ?? null,
        eventTimestamp:  new Date(payload.timestamp),
      });
      await this.auditLogRepo.save(log);
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Duplicate correlationId — idempotent ack, skip silently
        this.logger.warn(`Duplicate audit event [${payload.correlationId}] skipped`);
        return;
      }
      // DB down or unknown — re-throw → rabbitmq-client nacks → DLQ
      throw e;
    }
  }
}
```

`isUniqueViolation` checks for Postgres error code `'23505'` — same pattern used throughout NestJS+TypeORM projects.

---

#### [MODIFY] [audit.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/audit.module.ts)

```diff
-import { AuditService } from './audit.service';
-import { AUDIT_SERVICE } from './audit.interface';
+import { AuditConsumerService } from './audit-consumer.service';

 @Global()
 @Module({
-  providers: [{ provide: AUDIT_SERVICE, useClass: AuditService }],
-  exports: [AUDIT_SERVICE],
+  imports: [TypeOrmModule.forFeature([AuditLog])],
+  providers: [AuditConsumerService],
+  exports: [],          // nothing exported — audit is self-contained
 })
 export class AuditModule {}
```

> [!NOTE]
> `@Global()` can be removed since nothing imports from `AuditModule` anymore.

---

### 6. Migration

#### [NEW] Migration: `AlterAuditLogs` (timestamp auto-generated by TypeORM CLI)

```sql
-- up
ALTER TABLE audit_logs
  DROP COLUMN user_id,
  ADD COLUMN correlation_id   VARCHAR(36)  NOT NULL UNIQUE,
  ADD COLUMN event_type       VARCHAR(100) NOT NULL,
  ADD COLUMN entity_type      VARCHAR(100) NOT NULL,
  ADD COLUMN performed_by     VARCHAR(255) NOT NULL,
  ADD COLUMN old_value        JSONB,
  ADD COLUMN new_value        JSONB,
  ADD COLUMN metadata         JSONB,
  ADD COLUMN event_timestamp  TIMESTAMP    NOT NULL;

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at);
```

> [!WARNING]
> The existing migration `AddAuditLogs` created the table with `synchronize: true` active —
> confirm the table structure before running. Since there is no production data, a straightforward
> ALTER is safe.

---

## File Change Summary

| File | Change |
|---|---|
| `.env.example` / `.env` | Add 5 new vars |
| `outbox/types/outbox-payload.type.ts` | **NEW** — typed discriminated union |
| `outbox/entities/outbox-message.entity.ts` | `payload: any` → `payload: OutboxPayload` |
| `outbox/outbox.service.ts` | `payload: any` → `payload: OutboxPayload` |
| `notifications/worker/notification-worker.service.ts` | Remove magic strings, type payload |
| `flights/flights.service.ts` | Replace `auditService.writeLog` + magic strings |
| `hotels/hotels.service.ts` | Same as flights |
| `audit/audit.service.ts` | **DELETE** |
| `audit/audit.interface.ts` | **DELETE** |
| `audit/audit-action.enum.ts` | Extend with payment actions |
| `audit/entities/audit-log.entity.ts` | Full schema replace |
| `audit/audit-consumer.service.ts` | **NEW** |
| `audit/audit.module.ts` | Wire consumer + entity |
| `migrations/AlterAuditLogs.ts` | **NEW** |

---

## Verification Plan

### Build
```bash
npm run build   # must pass with zero TypeScript errors
```

### Manual (docker compose up)
1. `POST /flights/book` → RabbitMQ UI (`localhost:15672`):
   - `booking.notifications` exchange receives 1 message → consumed → `notifications` table row
   - `audit.exchange` receives 1 message → consumed → `audit_logs` row with `correlationId`
2. Stop RabbitMQ, trigger a booking → both outbox rows stay `READY`; restore RabbitMQ → pg_cron replays them within 5 minutes
3. Replay the same audit message manually (same `correlationId`) → `audit_logs` must still have only **one** row (dedup working)
4. Stop Postgres mid-consumer → rabbitmq-client nacks → message requeued (DLQ if configured)
