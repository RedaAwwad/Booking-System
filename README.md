# Booking System API

A flight and hotel booking backend built as a **modular monolith** with **NestJS**. It aggregates live offers from multiple providers, creates bookings with **transactional-outbox** guarantees, and ships with a full **observability stack** (OpenTelemetry, Loki, Tempo, Prometheus, Grafana) and an 8-scenario **k6 performance suite**.

![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-000000?logo=opentelemetry&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?logo=grafana&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

---

## Contents

- [What this project demonstrates](#what-this-project-demonstrates)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Engineering deep dives](#engineering-deep-dives)
  - [1. Adapter + scatter-gather provider aggregation](#1-adapter--scatter-gather-provider-aggregation)
  - [2. Deterministic Redis caching](#2-deterministic-redis-caching)
  - [3. Transactional outbox with LISTEN/NOTIFY and a pg_cron safety net](#3-transactional-outbox-with-listennotify-and-a-pg_cron-safety-net)
  - [4. Automatic audit trail via TypeORM subscribers + request context](#4-automatic-audit-trail-via-typeorm-subscribers--request-context)
  - [5. Module boundaries enforced with facades](#5-module-boundaries-enforced-with-facades)
  - [6. Authentication and input hardening](#6-authentication-and-input-hardening)
- [Observability](#observability)
- [Performance testing](#performance-testing)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Roadmap and known gaps](#roadmap-and-known-gaps)
- [More documentation](#more-documentation)

---

## What this project demonstrates

| Skill area | What's implemented | Where to look |
|---|---|---|
| **Architecture** | Modular monolith, facade/interface boundaries between modules, dependency inversion via injection tokens | `src/modules/*/facades`, `src/modules/*/interfaces` |
| **Distributed-systems patterns** | Transactional outbox, at-least-once delivery, scatter-gather, adapter pattern | `src/modules/flights`, `src/modules/external-api`, `src/modules/providers` |
| **Resilience** | Per-provider timeouts, `Promise.allSettled` partial results, auto-reconnecting Postgres listener, cron safety net | `flight-external-api.service.ts`, `flight-event-dispatcher.service.ts` |
| **Data & messaging** | PostgreSQL (TypeORM + migrations), Redis cache, RabbitMQ (direct exchanges, durable queues) | `src/migrations`, `src/common/cache`, `notification-worker.service.ts` |
| **Security** | JWT access + rotating refresh tokens, bcrypt, auth/admin guards, XSS sanitization, whitelist validation | `src/common/guards`, `src/modules/auth`, `src/common/sanitize` |
| **Observability** | Wide structured events, OpenTelemetry tracing, log↔trace correlation, async-pipeline correlation IDs | `logger.service.ts`, `OBSERVABILITY.md` |
| **Performance engineering** | k6 smoke / load / stress / spike / soak / breakpoint / auth / concurrency suites with shared SLO thresholds | `k6/` |
| **DevOps** | Multi-stage Dockerfile (non-root prod image), custom Postgres image with `pg_cron`, Compose stack with health checks, nginx reverse proxy | `Dockerfile`, `Dockerfile.postgres`, `docker-compose.yml` |

---

## Architecture

```
                         ┌──────────────┐
          HTTP ─────────►│    nginx     │
                         └──────┬───────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        NestJS modular monolith                      │
│                                                                     │
│  auth ─► user / customer (via facades)                              │
│                                                                     │
│  flights ──► external-api (scatter-gather) ──► providers            │
│     │              │                              ├─ Duffel         │
│     │              └─► Redis cache                └─ FlightAPI.io   │
│     │                                                               │
│     └─► [ one DB transaction ]                                      │
│           ├─ transactions row                                       │
│           ├─ flight_bookings row   ──► TypeORM subscriber ─┐        │
│           └─ flight_outbox_messages (notification) ◄───────┘ (audit)│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ LISTEN/NOTIFY  (+ pg_cron every 5 min)
                               ▼
                  FlightEventDispatcher ─► FlightPublisher ─► RabbitMQ
                                                                 │
                                         notification worker ◄───┤ (email / SMS)
                                         audit consumer      ◄───┘

Telemetry:  app ─traces─► OTel Collector ─► Tempo        ┐
            app ─logs───► Loki                           ├─► Grafana (one correlated view)
                          Prometheus ◄─ scrapes collector┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | NestJS, TypeScript |
| Database | PostgreSQL 16 (+ `pg_cron`), TypeORM |
| Cache | Redis |
| Messaging | RabbitMQ (`rabbitmq-client`) |
| Auth | JWT (`jsonwebtoken`), bcrypt, `nestjs-cls` for request context |
| External APIs | Duffel, FlightAPI.io |
| Validation | `class-validator`, `class-transformer`, `class-sanitizer` |
| API docs | Swagger / OpenAPI |
| Observability | OpenTelemetry, Loki, Tempo, Prometheus, Grafana, Winston |
| Load testing | k6 |
| Infra | Docker, Docker Compose, nginx |

---

## Engineering deep dives

### 1. Adapter + scatter-gather provider aggregation

Every external provider implements one small interface, so the rest of the system never knows which vendor it is talking to:

```ts
// src/modules/providers/interfaces/flight-provider.interface.ts
export interface IFlightProvider {
  readonly providerName: string;
  searchFlights(query: FlightsSearchDto): Promise<Flight[]>;
}
```

Providers are registered as a single injectable list. **Adding a third provider is one adapter class plus one line in this factory; the aggregator is untouched.**

```ts
// src/modules/providers/providers.module.ts
{
  provide: 'FLIGHT_PROVIDERS',
  useFactory: (duffel: DuffelFlightsAdapter, flightApi: FlightApiAdapter) => {
    return [duffel, flightApi];
  },
  inject: [DuffelFlightsAdapter, FlightApiAdapter],
},
```

The aggregator fans out to all providers in parallel, races each call against a timeout, and uses `Promise.allSettled` so **one slow or failing provider degrades the response instead of failing it**. Failures are reported alongside the data:

```ts
// src/modules/external-api/flight-external-api.service.ts
const results = await Promise.allSettled(
  this.providers.map((provider) =>
    this.withTimeout(
      provider.searchFlights(query),
      this.timeoutInMilliseconds,
      provider.providerName,
    ),
  ),
);

results.forEach((result, index) => {
  const providerName = this.providers[index].providerName;
  if (result.status === 'fulfilled') {
    data.push(...result.value);
  } else {
    const errorMsg = (result.reason as Error)?.message || 'Unknown Error';
    errors.push({ provider: providerName, error: errorMsg });
  }
});

return { data, errors };
```

```ts
private withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms for ${providerName}`)), ms),
  );
  return Promise.race([promise, timeout]);
}
```

### 2. Deterministic Redis caching

Search results are cached under a key derived from the query. Parameters are filtered and **sorted before hashing**, so `?origin=LHR&destination=JFK` and `?destination=JFK&origin=LHR` hit the same entry:

```ts
// src/common/cache/cache-key.util.ts
export function buildCacheKey(prefix: string, query: object): string {
  const sorted = Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const hash = createHash('sha256')
    .update(JSON.stringify(sorted))
    .digest('hex');
  return `${prefix}:${hash}`;
}
```

Cache writes are wrapped so a Redis failure never fails a search. The failure is recorded on the request's telemetry event instead (see [Observability](#observability)).

### 3. Transactional outbox with LISTEN/NOTIFY and a pg_cron safety net

**The problem:** a booking must be saved *and* a confirmation email must be sent. Doing both directly means a crash between the DB commit and the broker publish silently loses the email (or sends one for a booking that rolled back).

**The solution:** the booking, its payment transaction, and the outbox message are written in **one database transaction**. A separate relay publishes outbox rows to RabbitMQ afterwards.

```ts
// src/modules/flights/flights.service.ts
const result = await this.dataSource.transaction(async (em) => {
  const transaction = await this.transactionsService.createWithEntityManager(em, {
    userId: dto.userId,
    amount: dto.totalPrice,
    currency: dto.currency,
    paymentMethod: dto.paymentMethod,
  });
  const flightBooking = em.create(FlightBooking, { /* route, dates, price, ... */ });
  await em.save(FlightBooking, flightBooking);

  await this.outboxService.writeEvent(em, {
    kind: 'notification',
    correlationId,
    transactionId: transaction.id,
    type: 'EMAIL',
    recipient: dto.userEmail,
    subject: `Flight booking confirmation (${dto.origin} → ${dto.destination})`,
    content: 'Your flight booking is confirmed. Details...',
  } satisfies NotificationPayload);

  return { message: 'Flight booking initiated', transactionId: transaction.id, bookingId: flightBooking.id };
});
```

The relay uses **PostgreSQL `LISTEN/NOTIFY` for low-latency delivery**, plus a **`pg_cron` job every 5 minutes as a safety net**, because `NOTIFY` is fire-and-forget: if the listener is down when a notification fires, that notification is gone. The cron job re-notifies anything still `READY`, and on startup the dispatcher drains the backlog.

```ts
// src/modules/flights/flight-event-dispatcher.service.ts
await this.dataSource.query(`
  SELECT cron.schedule('flight-outbox-relay', '*/5 * * * *', $$
    DO $body$ DECLARE rec RECORD;
    BEGIN
      FOR rec IN SELECT * FROM flight_outbox_messages WHERE status = 'READY' ORDER BY created_at ASC
      LOOP
        PERFORM pg_notify('flight_outbox', row_to_json(rec)::text);
      END LOOP;
    END; $body$;
  $$);
`);
```

The listener also survives connection loss:

```ts
pgClient.on('end', () => {
  this.logger.warn('pg connection ended unexpectedly. Reconnecting in 5s...');
  this.queryRunner.release().catch(() => {});
  setTimeout(() => this.setupListener(), 5000);
});
```

Delivery is **at-least-once**: a record is deleted only after a successful publish. Each module (flights, hotels) owns its own outbox table, dispatcher, and publisher so one domain's backlog cannot starve another (see migration `SplitOutboxPerModule`).

### 4. Automatic audit trail via TypeORM subscribers + request context

Business code never writes audit records by hand. A TypeORM `EntitySubscriber` observes inserts and updates and writes an audit event **into the same transaction's outbox**. The "who did this" comes from request-scoped context (`nestjs-cls`), set once in the auth guard, so no method signature has to carry a `userId` around:

```ts
// src/common/guards/auth.guard.ts
request['user'] = payload;
// Subscribers read this later inside transactions without any method threading.
this.cls.set('userId', payload.userId);
```

```ts
// src/modules/flights/subscribers/flight-booking.subscriber.ts
async afterInsert(event: InsertEvent<FlightBooking>): Promise<void> {
  const entity = event.entity;
  if (!entity) return;

  const performedBy = this.clsService.get('userId') ?? 'SYSTEM';

  await this.writeAuditEvent(event.manager, {
    action:    AuditAction.FLIGHT_BOOKING_CREATED,
    eventType: 'flight_booking.created',
    entityId:  entity.id,
    performedBy,
    newValue:  this.toSnapshot(entity),
  });
}
```

Because the audit event goes through the outbox, **it commits or rolls back atomically with the booking**.

### 5. Module boundaries enforced with facades

Modules don't import each other's services. They depend on an **interface plus an injection token** that the owning module implements through a facade. `AuthService` can use the user and customer modules without knowing how either is built:

```ts
// src/modules/user/interfaces/user-module.interface.ts
export interface IUserModuleApi {
  findUserByEmail(email: string, select?: FindOptionsSelect<User>): Promise<User | null>;
  findUserById(userId: string, select?: FindOptionsSelect<User>): Promise<User | null>;
  createUser(data: Partial<User>, tx?: EntityManager): Promise<User>;
  assignRoleToUser(userId: string, roleKey: RoleKey, tx?: EntityManager): Promise<boolean>;
  // ...
}
export const USER_MODULE_API = Symbol('USER_MODULE_API');
```

```ts
// src/modules/auth/services/auth.service.ts
constructor(
  @Inject(USER_MODULE_API) private readonly userModuleFacade: IUserModuleApi,
  @Inject(CUSTOMER_MODULE_API) private readonly customerModuleFacade: ICustomerModuleApi,
  // ...
) { }
```

This keeps the monolith honest: each module could be extracted into a service later by swapping the facade for a network client.

### 6. Authentication and input hardening

- **Rotating refresh tokens.** Using a refresh token deletes it and issues a new pair; `logoutAll` revokes every session for a user.
- **No user enumeration.** Unknown email and wrong password return the same `Invalid credentials` error.
- **Defense in depth on input.** A global sanitize pipe strips XSS payloads, then a validation pipe whitelists fields and rejects unknown properties.

```ts
// src/main.ts
app.useGlobalPipes(
  new SanitizePipe(), // custom pipe to sanitize inputs from XSS attacks
  new ValidationPipe({
    transform: true,
    whitelist: true,            // strip unknown properties
    forbidNonWhitelisted: true, // throw error if unknown props are sent
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

```ts
// src/modules/auth/services/auth.service.ts
if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');

const isValidPassword = await verifyPassword(dto.password, user.password);
if (!isValidPassword) throw new UnauthorizedException('Invalid credentials');
```

Access control is guard-based: `AuthGuard` protects the auth, user, customer, and role routes, and `AdminGuard` restricts admin-only operations. A reusable `@Roles(...)` decorator and `RolesGuard` are implemented for finer-grained checks but are not applied to any route yet.

---

## Observability

The goal: when a request is slow or a booking fails, answer **what happened and why** from one screen, not from grepping several systems.

**Stack:** OpenTelemetry (SDK + Collector) → **Tempo** (traces) · Winston → **Loki** (logs) · **Prometheus** (metrics) · **Grafana** on top of all three.

### Wide structured events

Instead of several scattered log lines per request, each unit of work builds **one JSON event** and emits it **once, on every exit path** (success and failure). Every field becomes independently queryable in Loki.

```ts
// src/modules/external-api/flight-external-api.service.ts
const SearchEvent = {
  kind: 'search',
  origin: query.origin,
  destination: query.destination,
  cache_key: cacheKey,
  cache_hit: false,
  providers_called: [] as string[],
  providers_result: [] as ProviderResult[],   // per-provider count or error
  total_results: 0,
  duration_ms: 0,
  cache_write_status: '' as 'ok' | 'failed' | 'not_attempted',
  timestamp: new Date(),
};

const emit = () => {
  SearchEvent.duration_ms = performance.now() - start;
  this.logger.log(SearchEvent);
};
// emit() is called on the cache-hit path AND the cache-miss path,
// so no exit can silently skip telemetry.
```

The custom logger spreads event fields into top-level log fields (instead of stringifying them into `message`) and **automatically stamps every log line with the active OpenTelemetry `trace_id` / `span_id`**:

```ts
// src/common/logger/logger.service.ts
if (typeof message === 'object' && message !== null) {
  const { kind, ...rest } = message;
  msgString = kind ? String(kind) : 'event';
  meta = { ...meta, ...rest };
}

private getTraceContext(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}
```

### One-click correlation between logs and traces

Grafana is provisioned so a span in Tempo links to its logs in Loki, and a `trace_id` in a Loki line links back to its trace:

```yaml
# grafana/provisioning/datasources/datasources.yaml
- name: Loki
  uid: loki
  type: loki
  jsonData:
    derivedFields:
      - datasourceUid: tempo
        matcherRegex: '"trace_id":"(\w+)"'
        name: TraceID
        url: '$${__value.raw}'
```

### Following work across the async boundary

`trace_id` disappears once the HTTP request ends, but a booking's confirmation email is published later by the outbox relay. A `correlation_id` generated at booking time travels **inside the outbox payload**, so three events line up even minutes apart:

| Event `kind` | Emitted by | Extra signal |
|---|---|---|
| `booking` | `FlightsService.createBooking` | status, duration, provider |
| `outbox_dispatch` | `FlightEventDispatcherService` | `relay_latency_ms` (how long the row waited) |
| `outbox_publish` | `FlightPublisherService` | `published` / `failed`, exchange, duration |

```logql
{job="booking-api"} | json | correlation_id="<uuid from the booking log>"
```

Full explanation, written for beginners: **[OBSERVABILITY.md](./OBSERVABILITY.md)**.

---

## Performance testing

The `k6/` directory contains eight scenarios sharing centralized SLO thresholds:

| # | Scenario | Purpose |
|---|---|---|
| 01 | Smoke | Quick sanity check (1 VU) |
| 02 | Load | Normal daily traffic (50 VUs) |
| 03 | Stress | Beyond expected capacity (200 VUs) |
| 04 | Spike | Flash-sale bursts (300 VUs) |
| 05 | Soak | Endurance and leak detection |
| 06 | Breakpoint | Ramp until the system breaks |
| 07 | Auth flow | Per-step latency of the full auth lifecycle |
| 08 | Booking concurrency | Many users booking the same resource at once (race conditions, double-booking, outbox correctness) |

```js
// k6/config/thresholds.js
export const DEFAULT_THRESHOLDS = {
  http_req_failed:   ['rate<0.01'],                    // < 1 % errors
  http_req_duration: ['p(95)<2000', 'p(99)<4000'],     // p95 < 2s, p99 < 4s
  checks:            ['rate>0.95'],
};
```

See [`k6/README.md`](./k6/README.md) for how to run each scenario.

---

## Getting started

### Prerequisites

- Docker and Docker Compose
- Node.js 24 (matches the Dockerfile) if you want to run the API outside Docker
- API keys for [Duffel](https://duffel.com/) and [FlightAPI.io](https://flightapi.io/)

### Run everything with Docker

```bash
cp .env.example .env
# edit .env: set DUFFEL_API_TOKEN, FLIGHTAPI_API_KEY, SMTP_*, and replace the JWT secrets

docker compose up -d --build
```

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| API via nginx | http://localhost:8080 |
| Swagger docs | http://localhost:3000/api-docs |
| Grafana (logs, traces, metrics) | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| RabbitMQ management | http://localhost:15672 |

### Try it

```bash
# search flights (aggregated across providers)
curl "http://localhost:3000/api/v1/flights?origin=LHR&destination=JFK&departure_date=2026-12-01&adults_count=1"
```

Then open Grafana → **Explore** → **Tempo**, find the trace, and click through to its logs.

### Useful scripts

```bash
npm run dev                                    # run the API with hot reload
npm run migration:generate --name=MyChange     # generate a migration
npm run migration:run                          # apply migrations
npm run seed:users                             # seed users
npm run test                                   # unit tests
npm run test:e2e                               # e2e tests
```

---

## Project structure

```
src/
├── common/
│   ├── cache/            # Redis cache service + deterministic key builder
│   ├── cls/              # request-scoped context (userId for audit)
│   ├── guards/           # AuthGuard, RolesGuard, AdminGuard
│   ├── logger/           # Winston logger: Loki transport, trace correlation
│   └── sanitize/         # XSS sanitization pipe
├── modules/
│   ├── auth/             # signup, login, refresh rotation, password reset, email verification
│   ├── user/  customer/  # exposed to other modules only via facades
│   ├── flights/          # search, booking, outbox, dispatcher, publisher, audit subscriber
│   ├── hotels/           # booking + outbox (search aggregation in progress)
│   ├── external-api/     # scatter-gather orchestration
│   ├── providers/        # Duffel and FlightAPI.io adapters
│   ├── transactions/     # payment transaction records
│   ├── notifications/    # RabbitMQ consumer, email and SMS senders
│   └── audit/            # audit types and actions
├── migrations/           # TypeORM migrations
└── tracing.ts            # OpenTelemetry SDK bootstrap (imported first in main.ts)
k6/                       # 8 performance scenarios
otel/ tempo/ prometheus/ grafana/   # observability stack configuration
```

---

## Roadmap and known gaps

Written down on purpose: knowing where a system is weak is part of owning it.

- **Payment confirmation.** Booking transactions are created as `PENDING`; a payment-confirmation step (e.g. a provider webhook moving them to `CONFIRMED` / `FAILED`) is not wired in yet.
- **Outbox retries.** A message that fails to publish is marked `FAILED`, and the cron relay only re-sends `READY` rows. A bounded retry with backoff and a dead-letter path is the next step.
- **Idempotent consumers.** Delivery is at-least-once, so consumers should deduplicate (the audit payload already carries a `correlationId` for this).
- **Hotel search.** Booking and outbox are in place; provider aggregation for hotel search is not implemented yet.
- **Hardening.** Apply `RolesGuard` / `@Roles(...)` where needed; put flight/hotel booking routes behind `AuthGuard` and derive `userId` from the JWT instead of the request body; add rate limiting; restrict CORS beyond `*`.
- **Schema management.** The dev database module uses TypeORM `synchronize`; move fully to migrations.
- **Tests.** The k6 suite is thorough, but unit and integration tests for the outbox relay and scatter-gather logic are still to be added.
- **Metrics and alerting.** Prometheus is running, but custom business metrics (booking success rate, provider win-rate) and SLO-based alerts are not defined yet.

---

## More documentation

| Doc | Topic |
|---|---|
| [`OBSERVABILITY.md`](./OBSERVABILITY.md) | The Loki/Tempo/Prometheus/Grafana stack, explained for beginners |
| [`k6/README.md`](./k6/README.md) | Running the performance suite |
| [`pg_cron_README.md`](./pg_cron_README.md) | The `pg_cron` setup used by the outbox relay |
| [`src/modules/audit/Auditing.md`](./src/modules/audit/Auditing.md) | Audit trail design |
| [`src/modules/audit/Selecting Auditing Architecture Strategy.md`](./src/modules/audit/Selecting%20Auditing%20Architecture%20Strategy.md) | Why the subscriber + outbox approach was chosen |