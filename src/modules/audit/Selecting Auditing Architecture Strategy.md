# Chat Conversation

Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

there is a Auditing.md file that uses different approach than the dummy way i sued in the auditing modulewhich should i use the only thing i know is this modular monolithic project would have some modules separated as micro services like payment and images and maybe others

### Planner Response

Let me look at both the `Auditing.md` file and the current auditing module implementation to compare the two approaches.

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System" -Recurse -Filter "Auditing.md" | Select-Object FullName`*

*Listed directory [Booking-System](file:///d:/Mentorship/Booking/Project/Booking-System) *

*Viewed [Auditing.md](file:///d:/Mentorship/Booking/Project/Booking-System/Auditing.md) *

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System\src" -Recurse -Filter "*.ts" | Where-Object { $_.DirectoryName -like "*audit*" -or $_.Name -like "*audit*" } | Select-Object FullName`*

*Viewed [audit.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/audit.service.ts) *

*Viewed [audit.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/audit.module.ts) *

*Viewed [audit-log.entity.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/entities/audit-log.entity.ts) *

*Viewed [audit.interface.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/audit.interface.ts) *

*Viewed [audit-action.enum.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/audit-action.enum.ts) *

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System\src" -Recurse -Filter "*.ts" | Select-String -Pattern "AuditService|AUDIT_SERVICE|writeLog" | Select-Object Filename, LineNumber, Line | Format-Table -AutoSize`*

### Planner Response

Now I have a complete picture of both approaches. Let me give you a clear analysis.

---

## Two Approaches: Which Should You Use?

Here's what you currently have vs. what `Auditing.md` proposes:

### Current Implementation (Direct / "Dummy" approach)

```
Business Service → auditService.writeLog(em, ...) → INSERT into audit_logs (same DB transaction)
```

- Writes audit log **inside the same TypeORM `EntityManager` transaction** as the business operation
- `flights.service.ts` and `hotels.service.ts` both inject `AuditService` directly
- Simple, no extra infrastructure
- **Tight coupling** — audit is part of the same DB transaction

### `Auditing.md` Approach (RabbitMQ Pub/Sub)

```
Business Service → AuditPublisher → RabbitMQ exchange → AuditConsumer → INSERT into audit_logs
```

- Business logic publishes an **async event** to a queue after the DB commit
- Consumer independently writes to the audit table
- Full **decoupling** — audit never blocks business operations
- Handles load spikes, dead-letter queues, deduplication via `correlationId`

---

## Which Should You Use?

**Use the RabbitMQ approach from `Auditing.md`.**

Here's why, specifically for your situation:

| Factor | Current (Direct) | RabbitMQ |
|---|---|---|
| **Microservice readiness** | ❌ Tightly coupled — payment/images modules can't write audit logs to a DB they don't own | ✅ Any future microservice just publishes a message |
| **Consistency** | If audit insert fails → whole booking transaction rolls back (audit kills business logic) | Audit failures never affect business logic |
| **Missing contexts** | No `oldValue`/`newValue`, no `correlationId`, no `performedBy` (system vs user) | Rich event schema |
| **Payment module** | Payment will be a separate service — it **cannot** share an `EntityManager` with your monolith DB | It just publishes to RabbitMQ regardless of its own DB |

> [!IMPORTANT]
> The moment payment/images become separate services, **they have no access to your monolith's `EntityManager`**. The current approach is architecturally incompatible with the microservice extraction you're planning.

---

## Recommended Migration Path

You don't need to do it all at once. A pragmatic order:

1. **Add RabbitMQ to docker-compose** (it's already prepped in the `.md`)
2. **Upgrade the `AuditLog` entity** — add `correlationId` (unique), `oldValue`/`newValue` (jsonb), `performedBy`, `eventType`
3. **Create `AuditPublisher` service** — wraps `AmqpConnection.publish()`, auto-assigns `correlationId` + `timestamp`
4. **Create `AuditConsumer` service** — listens to `audit.queue`, handles dedup via `correlationId`, nacks to DLQ on failure
5. **Migrate call sites** in `flights.service.ts` and `hotels.service.ts` from `auditService.writeLog(em, ...)` to `auditPublisher.publish(...)` — **called after the transaction commits**, not inside it
6. As payment/images split off, they get the same publisher, zero schema changes

The key insight is: your current approach works *only* while everything shares the same database. The RabbitMQ approach is the correct foundation for where your architecture is heading.

### User Input

there is an implemetaion of rabitmq in the outbox module different of cource but it is well structured strongly typed (no any or unknown cast) has an issue which is the exchangename and routing key is inside the entity which is wrong they should be in the environment take a look at the outbox module and see if we are gonna use similar approach

*Listed directory [src](file:///d:/Mentorship/Booking/Project/Booking-System/src) *

*Listed directory [modules](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules) *

*Listed directory [outbox](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox) *

*Listed directory [entities](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/entities) *

*Viewed [outbox-message.entity.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/entities/outbox-message.entity.ts) *

*Viewed [outbox.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/outbox.service.ts) *

*Viewed [publisher.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/publisher.service.ts) *

*Viewed [event-dispatcher.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/event-dispatcher.service.ts) *

*Viewed [outbox.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/outbox.module.ts) *

### Planner Response

Now let me look at how the outbox is called from business services to understand the full call pattern:

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System\src" -Recurse -Filter "*.ts" | Select-String -Pattern "writeEvent|OutboxService|exchangeName|routingKey" | Select-Object Filename, LineNumber, Line | Format-Table -AutoSize`*

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System\src" -Recurse -Filter "*.ts" | Select-String -Pattern "RABBITMQ|rabbitmq" | Select-Object Filename, LineNumber, Line | Format-Table -AutoSize`*

*Listed directory [notifications](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications) *

*Listed directory [worker](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications/worker) *

*Viewed [notification-worker.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications/worker/notification-worker.service.ts) *

### Planner Response

Now I have a complete picture. Let me also check the `.env.example` to see what's already defined for RabbitMQ:

*Viewed [.env.example](file:///d:/Mentorship/Booking/Project/Booking-System/.env.example) *

### Planner Response

Now I have everything I need for a thorough analysis. Here's the full picture:

---

## Analysis: Outbox Module Structure & the Exchange/Routing Key Problem

### What the outbox module does well ✅

The pattern in the outbox is actually quite solid:

```
Business Service
  └─ outboxService.writeEvent(em, { exchangeName, routingKey, payload })  ← inside DB tx
       └─ inserts row in outbox_messages (committed atomically with booking)

pg_notify trigger fires
  └─ EventDispatcherService hears it on outbox_channel
       └─ PublisherService.publishRecord(record)   ← reads exchangeName/routingKey from the row
            └─ rabbitmq-client sends to RabbitMQ exchange
```

- Uses `rabbitmq-client` (not `@golevelup/nestjs-rabbitmq`) — consistent across publisher and consumer
- `OnModuleInit`/`OnModuleDestroy` lifecycle hooks with clean teardown
- Connection errors are handled and logged
- `Publisher` is created with `confirm: true` (publisher confirms)
- Consumer auto-declares exchange + queue + binding in one place ([notification-worker.service.ts L56-L62](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications/worker/notification-worker.service.ts#L51-L63))

---

### The real issues you identified 🔴

**1. Exchange name and routing key are hardcoded strings in business services:**

```typescript
// flights.service.ts & hotels.service.ts
await this.outboxService.writeEvent(em, {
  exchangeName: 'booking.notifications',  // ← magic string
  routingKey: 'email.notifications',       // ← magic string
  payload: { ... },
});
```

They're scattered in call sites, duplicated in the notification worker consumer, and not in `.env`. If you rename the exchange, you hunt down every call site.

**2. `payload: any` throughout** — `OutboxService.writeEvent()`, `OutboxMessage.payload`, `handleNotification(payload: any)` — no type safety on what goes through the queue.

**3. `notification-worker.service.ts` also hardcodes the same strings** (lines 53, 56, 59-60).

---

### For the Audit module — the adapted approach

Yes, you should **mirror the outbox pattern** but fix both issues. The audit flow is simpler because audit doesn't go through the transactional outbox — it publishes directly after the DB commit (fire-and-forget, decoupled from the business transaction per `Auditing.md`).

Here's what the adapted structure looks like, fixing the hardcoding problem and the `any` typing:

**Routing config lives in `.env`:**
```
AUDIT_EXCHANGE=audit.exchange
AUDIT_QUEUE=audit.queue
AUDIT_ROUTING_KEY=audit.events
```

**A typed event contract instead of `any`:**
```typescript
// audit/types/audit-event.type.ts
export interface AuditEvent {
  eventType: string;      // 'booking.created', 'payment.captured'
  entityType: string;     // 'BOOKING', 'TRANSACTION'
  entityId: string;
  action: AuditAction;
  performedBy: string;    // userId or 'SYSTEM'
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlationId: string;  // UUID — for dedup in consumer
  timestamp: string;      // ISO string — producer-side time
}
```

**Publisher wraps routing config from ConfigService:**
```typescript
// audit-publisher.service.ts
const exchange = this.configService.getOrThrow<string>('AUDIT_EXCHANGE');
const routingKey = this.configService.getOrThrow<string>('AUDIT_ROUTING_KEY');
await this.publisher.send({ exchange, routingKey }, event satisfies AuditEvent);
```

**Consumer reads the same env vars to bind the queue:**
```typescript
// audit-consumer.service.ts — same pattern as notification-worker.service.ts
exchanges: [{ exchange: this.configService.getOrThrow('AUDIT_EXCHANGE'), type: 'topic' }],
queueBindings: [{ exchange: ..., routingKey: this.configService.getOrThrow('AUDIT_ROUTING_KEY') }]
```

---

### Summary: Yes, use the same pattern — with these fixes

| Concern | Outbox/Notifications today | Audit module (new) |
|---|---|---|
| RabbitMQ client library | `rabbitmq-client` ✅ | same — `rabbitmq-client` |
| Lifecycle hooks | `OnModuleInit`/`OnModuleDestroy` ✅ | same |
| Exchange/queue/routing key | ❌ hardcoded strings in call sites | ✅ `ConfigService.getOrThrow()` from `.env` |
| Payload typing | ❌ `any` | ✅ `AuditEvent` interface |
| Consumer error handling | re-throw to nack ✅ | same + dedup via `correlationId` |
| Connection setup | per-service `Connection` instance ✅ | same |

> [!TIP]
> When you also fix the outbox's hardcoding issue, the correct place for `exchangeName`/`routingKey` values is **not** in the entity row — they should be constants injected via `ConfigService` into `OutboxService.writeEvent()`. The entity stores them only because the publisher needs them later when it reads the row from the DB, which is actually a valid pattern for the outbox (since the row must be self-contained for bootstrap replay). The **real fix** for outbox is that the *call sites* (`flights.service.ts`, `hotels.service.ts`) should not use magic strings — they should reference constants from a single config file or env.

Want me to go ahead and plan the full audit module implementation using this structure?

### User Input

yes

*Viewed [outbox.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/outbox/outbox.service.ts) *

### Planner Response

Let me gather the remaining context I need before writing the plan.

*Viewed [flights.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/flights/flights.service.ts) *

*Viewed [1781970208368-AddAuditLogs.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/migrations/1781970208368-AddAuditLogs.ts) *

*Viewed [hotels.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/hotels/hotels.service.ts) *

*Viewed [app.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/app.module.ts) *

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System\src\migrations" | Select-Object Name | Sort-Object Name`*

*Viewed [notifications.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications/notifications.module.ts) *

### Planner Response

Now I have everything. Let me write the implementation plan:

*Edited relevant file*

### Planner Response

The plan is ready for your review. Here are the key design decisions I want your sign-off on before executing:

---

### 3 decisions that need your input

**1. Delete `IAuditService` / `AUDIT_SERVICE` token?**
The plan removes them entirely since `AuditPublisherService` is injected directly. This is simpler, but if you anticipate wanting to swap the audit backend (e.g., to a mock in tests), keeping the interface token is useful. I'd lean toward **deleting it** since the outbox and notification worker don't use tokens either — consistency wins.

**2. Audit publish inside or outside the transaction?**
The plan moves `publish()` **outside** the `dataSource.transaction(...)` block in both `flights.service.ts` and `hotels.service.ts`. This means if the publish fails, the booking is still committed (which is correct — audit failure must never roll back a booking). The trade-off is a small window where a booking succeeds but the audit event is not sent. That's the accepted trade-off for decoupled audit. Confirm you agree.

**3. `old_value` / `new_value` — how much snapshot detail do you want?**
For a booking create, there's no "old" state. The plan stores `null` for `oldValue` on creates. For a cancel, `oldValue` would be the old status and `newValue` the new one. This is fine for now — just confirming you don't need the entire entity snapshot (which would be a lot more data).

Once you approve, I'll execute all the file changes in order.

### User Input

the outbox has a retry mechanism using pg_cron in the DatabaseModule doyou think we should add a retry mechanism

*Viewed [database.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/database/database.module.ts) *

### Planner Response

Let me read the full database module to understand the pg_cron setup completely.

*Viewed [database.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/database/database.module.ts) *

### Planner Response

Good. Now I have the complete picture. Here's the honest architectural analysis:

---

## Should Audit Have a Retry Mechanism?

The answer depends on **why the outbox needs pg_cron** and whether that same problem applies to audit.

### Why the outbox has pg_cron

The outbox flow is:
```
outbox_messages row inserted (in DB tx)
  → pg_notify fired by trigger
    → EventDispatcherService hears it
      → PublisherService publishes to RabbitMQ
```

pg_cron re-fires `pg_notify` every 5 minutes for all `READY` rows. It exists to cover **one specific gap**: if the app was down when the trigger fired, the notification was missed and the row sits in `READY` forever. pg_cron is the safety net — it doesn't retry failed publishes, it replays missed notifications.

### The audit situation is fundamentally different

In the current plan, audit publishes **directly to RabbitMQ** after the transaction, with no persistent row in any table. There's nothing to retry from:

```
Flight booking tx commits
  → auditPublisher.publish(event)   ← if RabbitMQ is down here, event is GONE
    → RabbitMQ → AuditConsumer → audit_logs insert
```

So:
- **pg_cron can't help** — there's no audit-specific table to scan and replay
- **`maxAttempts: 2`** in the publisher handles transient blips (< 1 second), not outages
- A prolonged RabbitMQ outage between the booking commit and the publish call = **silent audit data loss**

### The real fix: route audit through the existing outbox

Instead of adding new retry infrastructure, the cleanest solution is to **write audit as an outbox row inside the business transaction** — the same way notifications work. This gives you:

| | Current audit plan | Route through outbox |
|---|---|---|
| Audit survives RabbitMQ outage | ❌ | ✅ (written to DB first) |
| Audit survives app crash | ❌ | ✅ (pg_cron catches it) |
| Audit rolls back if booking fails | ❌ (published after tx) | ✅ (inside same tx) |
| Extra infrastructure | New publisher + consumer | Only new consumer |
| Exchange/routing isolation | Separate `AUDIT_EXCHANGE` | Same, via separate routing key |

### What this changes in the plan

`AuditPublisherService` is **removed entirely** — the existing `OutboxService.writeEvent()` handles delivery. Business services call it twice inside the transaction:

```typescript
// Inside dataSource.transaction():

// 1. Notification outbox event (existing)
await this.outboxService.writeEvent(em, {
  exchangeName: NOTIFICATIONS_EXCHANGE,  // from config
  routingKey:   NOTIFICATIONS_ROUTING_KEY,
  payload:      notificationPayload satisfies NotificationEvent,
});

// 2. Audit outbox event (new, same pattern)
await this.outboxService.writeEvent(em, {
  exchangeName: AUDIT_EXCHANGE,          // from config
  routingKey:   AUDIT_ROUTING_KEY,
  payload:      auditEvent satisfies AuditEvent,
});
```

The `AuditConsumerService` is still needed — it's the subscriber that reads from the audit queue and writes to `audit_logs`. The existing `PublisherService` in the outbox already delivers to whatever exchange/routing key is in the row — it doesn't care that some rows are for notifications and some are for audit.

> [!IMPORTANT]
> This also fixes the `OutboxService.writeEvent()` payload typing issue — since both notification and audit payloads flow through it, we need to type it as a generic branded type or a discriminated union rather than `any`. I'll include that in the plan update.

---

**Recommendation: Yes to retry, but via the existing outbox — not a new mechanism.** Shall I update the implementation plan with this revised approach?

### User Input

yes

### Planner Response

Let me check one more thing before updating — the `OutboxService` payload type and how we'll fix it for both consumers.

*User accepted the command `Get-ChildItem -Path "d:\Mentorship\Booking\Project\Booking-System\src\modules\notifications" -Recurse -Filter "*.ts" | Select-Object FullName`*

*Viewed [notification.entity.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/notifications/entities/notification.entity.ts) *

### Planner Response

Good — now I have everything. Let me update the plan:

*Edited relevant file*

### User Input

why are you stuck

### Planner Response

You're right — the plan is approved, time to execute. Let me create the task tracker and start building.

*Edited relevant file*

*Viewed [.env](file:///d:/Mentorship/Booking/Project/Booking-System/.env) *

### Planner Response

**Step 1 — Env vars**

*Edited relevant file*

*Edited relevant file*

### Planner Response

**Step 2 — Outbox payload type**

*Edited relevant file*

### Planner Response

**Step 3 — Fix `payload: any` in entity and service**

*Edited relevant file*

*Edited relevant file*

### Planner Response

**Step 4 — Fix notification worker magic strings + payload type**

*Edited relevant file*

### Planner Response

The tool appended instead of replacing. Let me fix the file completely:

*Edited relevant file*

### Planner Response

**Step 5 — Rewrite flights.service.ts**

*Edited relevant file*

### Planner Response

**Step 6 — Rewrite hotels.service.ts**

*Edited relevant file*

### Planner Response

**Step 7 — Check if flights/hotels modules inject ConfigService, fix if needed**

*Viewed [flights.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/flights/flights.module.ts) *

*Viewed [hotels.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/hotels/hotels.module.ts) *

### Planner Response

`ConfigService` is globally provided via `ConfigModule.forRoot({ isGlobal: true })` so no module changes needed. Both modules are clean.

**Step 8 — Delete old audit files**

*User accepted the command `Remove-Item "d:\Mentorship\Booking\Project\Booking-System\src\modules\audit\audit.service.ts"; Remove-Item "d:\Mentorship\Booking\Project\Booking-System\src\modules\audit\audit.interface.ts"`*

### Planner Response

**Step 9 — Extend AuditAction enum**

*Edited relevant file*

### Planner Response

**Step 10 — Rewrite AuditLog entity with full schema**

*Edited relevant file*

### Planner Response

**Step 11 — New AuditConsumerService**

*Edited relevant file*

### Planner Response

**Step 12 — Rewrite audit.module.ts**

*Edited relevant file*

### Planner Response

**Step 13 — Migration**

*User accepted the command `npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:create src/migrations/AlterAuditLogs`*

*Edited relevant file*

### Planner Response

**Step 14 — Build check**

*User accepted the command `npm run build 2>&1`*

### Planner Response

TypeScript's `isolatedModules` + `emitDecoratorMetadata` requires that types used in decorated class bodies be imported with `import type`. Fix:

*Edited relevant file*

*User accepted the command `npm run build 2>&1`*

### User Input

the randomUUID from crypto is v4 use a version 7 the one with timestamp for query performance

### Planner Response

Good call — UUID v7's monotonically-increasing timestamp prefix means B-tree index inserts stay sequential, avoiding page splits. Let me check what's available first.

*User accepted the command `node -e "const v = process.versions.node.split('.')[0]; console.log('Node major:', v)"`*

*Grep searched codebase*

### Planner Response

Node 24 ships with `crypto.randomUUID()` but only v4. UUID v7 is not yet in Node's native `crypto`, so we need the `uuid` package. Let me install it and create a small utility:

*User accepted the command `npm install uuid && npm install --save-dev @types/uuid`*

*User accepted the command `npm install uuid @types/uuid`*

### Planner Response

While that installs, create the utility helper:

*Edited relevant file*

### Planner Response

`uuid` is installed. Now swap `randomUUID` for `generateUUID` in both call sites:

*Edited relevant file*

*Edited relevant file*

### Planner Response

Final build check:

*User accepted the command `npm run build 2>&1`*

### Planner Response

Clean build. Here's a summary of what was done for this change:

---

### Why UUID v7 here

`correlationId` is the **dedup key** — it's stored in a `VARCHAR(36) UNIQUE` column and queried by the consumer on every insert attempt. UUID v7's timestamp prefix means:

- New `correlationId` values are always **lexicographically larger** than previous ones
- B-tree inserts go to the **rightmost leaf** of the index — no random page splits
- The index stays hot and compact, especially under high booking volume

The new [uuid.util.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/utils/uuid.util.ts) wraps the `uuid` package's `v7` in a single place — so if Node.js ever ships native `crypto.randomUUIDv7()` in a future release, there's one file to update, not every call site.

### User Input

explain the correlationId 

*Viewed [audit-consumer.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/modules/audit/audit-consumer.service.ts) *

### Planner Response

## What `correlationId` does

### The problem it solves: message redelivery

RabbitMQ guarantees **at-least-once delivery** — not exactly-once. This means the same message can arrive at the consumer more than once. Here's when that happens in your system:

```
AuditConsumerService receives message
  → calls auditLogRepo.save()
  → DB write succeeds ✅
  → consumer is about to send ACK back to RabbitMQ...
  → app crashes / network blip 💥

RabbitMQ never got the ACK, so it assumes the message was lost.
It redelivers the same message to the next available consumer.
```

Without `correlationId`, you'd get **two identical rows** in `audit_logs` for the same booking event.

---

### How it works end-to-end

**Producer side** (`flights.service.ts`) — generated once, at booking time:
```typescript
correlationId: generateUUID(),  // e.g. "0190a3b2-1234-7abc-..."
```
This UUID travels inside the outbox row → `outbox_messages.payload` → RabbitMQ message body.

**Consumer side** (`audit-consumer.service.ts`) — used as the uniqueness guard:
```typescript
// 1. Try to insert with that correlationId
await this.auditLogRepo.save(log);  // column has UNIQUE constraint

// 2a. First delivery → insert succeeds → ACK sent
// 2b. Redelivery → Postgres throws error code 23505 (unique violation)
//     → isUniqueViolation(e) catches it → return without throwing
//     → rabbitmq-client sees no error → sends ACK anyway
//     → message is gone from the queue, no duplicate row
```

**Database schema** enforces it:
```typescript
@Column({ type: 'varchar', length: 36, unique: true, name: 'correlation_id' })
correlationId: string;
```
The unique constraint is the actual safety mechanism — the `catch` block just handles it gracefully instead of crashing.

---

### The two-path diagram

```
Message arrives at AuditConsumerService
         │
         ▼
  try { auditLogRepo.save(log) }
         │
    ┌────┴──────────────────────┐
    │ Success                   │ Unique violation (23505)
    │ (first delivery)          │ (redelivery)
    ▼                           ▼
Row inserted in audit_logs   catch block → return (no throw)
ACK sent to RabbitMQ         ACK sent to RabbitMQ
                             No duplicate row ✅
         │
         ▼
  Other error (DB down, etc.)
  → throw → rabbitmq-client nacks
  → message stays in queue / goes to DLQ
```

---

### Why UUID v7 specifically

You asked to use v7 because `correlationId` sits in a `UNIQUE` indexed column. Every booking inserts a new value. With v4 (random), those values are scattered across the entire UUID space, causing **random B-tree page splits**. With v7, new UUIDs are always timestamp-prefixed and greater than all previous ones, so inserts land at the **rightmost leaf** of the index — sequential, compact, no fragmentation.