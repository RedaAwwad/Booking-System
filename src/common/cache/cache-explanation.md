# Cache Module Explanation

This document provides a detailed breakdown of the booking system's caching mechanism, located in the [src/common/cache](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/cache) directory. It explains the design patterns, code syntax, logical flow, and cryptographic hashing logic.

---

## 1. Directory Structure and Files

The module is composed of the following files:

1.  **[cache.interface.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/cache/cache.interface.ts)**: Defines the typescript interface contract and the dependency injection token.
2.  **[cache-key.util.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/cache/cache-key.util.ts)**: Contains a utility function to build deterministic cache keys.
3.  **[cache.service.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/cache/cache.service.ts)**: Implements the interface to interact with NestJS's underlying cache manager.
4.  **[cache.module.ts](file:///d:/Mentorship/Booking/Project/Booking-System/src/common/cache/cache.module.ts)**: Orchestrates the Redis configuration and configures it globally.

---

## 2. File-by-File Explanation

### A. The Interface (`cache.interface.ts`)
TypeScript interfaces are compiled away and do not exist at runtime. Because NestJS depends on runtime identifiers to perform Dependency Injection, we declare both an interface and a string token:

```typescript
export interface ICacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

export const CACHE_SERVICE = 'CACHE_SERVICE';
```
*   `ICacheService`: Standardizes what caching methods must look like.
*   `CACHE_SERVICE`: A string token used as a token key for injection. Classes use `@Inject(CACHE_SERVICE)` to inject the implementation.

---

### B. Hashing & Keys (`cache-key.util.ts`)
To look up cached queries in Redis, we need a unique, URL-safe string representation of the request parameters. We construct this using the `buildCacheKey` function:

```typescript
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

#### Step-by-Step Logic:
1.  **Extract & Filter**: `Object.entries(query)` extracts key-value pairs from the object. `.filter(...)` discards keys containing `null` or `undefined` values.
2.  **Deterministic Sorting**: `.sort(...)` sorts keys alphabetically. This ensures that `{ origin: 'LHR', destination: 'JFK' }` and `{ destination: 'JFK', origin: 'LHR' }` are processed identically. Without sorting, they would produce different hashes and cause cache misses.
3.  **Rebuild**: `Object.fromEntries(...)` compiles the sorted pairs back into a clean JavaScript object.
4.  **Hashing Engine**: `createHash('sha256')` initializes the SHA-256 algorithm from Node.js's `crypto` module.
5.  **Inject Data**: `.update(JSON.stringify(sorted))` stringifies the object (e.g. `{"destination":"JFK","origin":"LHR"}`) and feeds it into the hashing algorithm.
6.  **Final Digest**: `.digest('hex')` calculates the hash and returns it as a 64-character hexadecimal string containing only letters `a-f` and numbers `0-9`.
7.  **Format**: Appends the module prefix to form the final Redis key (e.g., `flights:6ac32095f32a8206d90d8a4369aa64b732fb1a52e72bcbbff2c382626e2a532d`).

---

### C. Dynamic Module Configuration (`cache.module.ts`)
We use the `useFactory` pattern inside `NestCacheModule.registerAsync` to configure Redis dynamically:

```typescript
NestCacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    stores: [
      new KeyvRedis(
        config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      ),
    ],
    ttl: Number(config.get<string>('CACHE_TTL') ?? 300000),
  }),
})
```

#### Key Concepts:
*   **`isGlobal: true`**: Makes this configured cache instance globally available across the application.
*   **`imports` & `inject`**: Tells NestJS that this cache initialization depends on the `ConfigModule`, and to inject the `ConfigService` instance.
*   **`useFactory`**: A callback function executed by NestJS after resolving `ConfigService` (passed as the `config` argument). It reads from environment variables (`REDIS_URL` and `CACHE_TTL`) and dynamically returns the configuration object.
*   **Syntax: `=> ({ ... })`**: The parentheses wrapping the curly brackets are required in JavaScript/TypeScript arrow functions to implicitly return an object literal without writing the `return` keyword.

---

### D. The Cache Service Wrapper (`cache.service.ts`)
Implements `ICacheService` and injects the actual `CACHE_MANAGER` provided by NestJS:

```typescript
@Injectable()
export class CacheServiceImpl implements ICacheService {
  private readonly defaultTtl: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = Number(
      this.configService.get<string>('CACHE_TTL') ?? 300000,
    );
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl ?? this.defaultTtl);
  }
}
```
*   This wraps the generic `cacheManager` methods (`get` and `set`) to provide clean types and enforce fallback/default TTL configurations.

---

## 3. End-to-End Execution Flow

Here is how the Cache module operates during a flight query in `FlightExternalApiService` (represented as an ASCII sequence flow):

```text
 Client                 FlightExternalApiService             CacheServiceImpl                 Redis DB             External APIs
   |                                |                               |                            |                     |
   |------ handle(query) ---------->|                               |                            |                     |
   |                                |--- 1. buildCacheKey()         |                            |                     |
   |                                |--- 2. get(cacheKey) --------->|                            |                     |
   |                                |                               |------ 3. get(key) -------->|                     |
   |                                |                               |<----- 4. Value/Null -------|                     |
   |                                |<-- 5. Value/Undefined --------|                            |                     |
   |                                |                                                            |                     |
   |-- [ IF CACHE HIT ] ------------|                                                            |                     |
   |<----- Return cached data ------|                                                            |                     |
   |                                |                                                            |                     |
   |-- [ IF CACHE MISS ] -----------|                                                            |                     |
   |                                |----------------- 6. searchFlights() -------------------------------------------->|
   |                                |<---------------- 7. Fresh data -------------------------------------------------|
   |                                |--- 8. set(cacheKey, data) --->|                            |                     |
   |                                |                               |------ 9. set(key, value) ->|                     |
   |<----- Return fresh data -------|                               |                            |                     |
```

