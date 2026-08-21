# k6 Performance Test Suite – Booking System

A comprehensive performance testing suite built with [k6](https://k6.io/) covering 8 distinct traffic simulation scenarios for the Booking System API.

---

## Directory Structure

```
k6/
├── config/
│   └── thresholds.js          # Shared SLA / threshold presets
├── helpers/
│   └── utils.js               # Base URL, auth helpers, random data generators
├── tests/
│   ├── 01-smoke.test.js       # Smoke – quick sanity (1 VU, 1 iteration)
│   ├── 02-load.test.js        # Load – normal daily traffic (50 VUs, 14 min)
│   ├── 03-stress.test.js      # Stress – beyond capacity (200 VUs, 12 min)
│   ├── 04-spike.test.js       # Spike – flash-sale burst (300 VUs x2)
│   ├── 05-soak.test.js        # Soak – endurance / leak detection (30 min+)
│   ├── 06-breakpoint.test.js  # Breakpoint – auto-abort at system limit
│   ├── 07-auth-flow.test.js   # Auth – per-step latency of full auth lifecycle
│   └── 08-booking-concurrency.test.js  # Concurrency – race condition detection
├── results/                   # Auto-created; timestamped JSON result files
└── run-tests.ps1              # PowerShell runner (local k6)
```

---

## Prerequisites

### Option A – Install k6 locally (recommended for dev)

```powershell
# Windows – winget
winget install k6

# Windows – Chocolatey
choco install k6
```

Verify: `k6 version`

### Option B – Docker (no install needed)

The `docker-compose.yml` includes a `k6` service under the `perf` profile. Start your stack first, then run tests against it.

---

## Running Tests

### Via PowerShell script (local k6)

```powershell
# Smoke – quick sanity check
.\k6\run-tests.ps1 -Test smoke

# Load – normal traffic (50 VUs)
.\k6\run-tests.ps1 -Test load

# Stress – push to limits (200 VUs)
.\k6\run-tests.ps1 -Test stress

# Spike – flash-sale simulation (300 VUs burst)
.\k6\run-tests.ps1 -Test spike

# Soak – 30-min endurance test
.\k6\run-tests.ps1 -Test soak

# Soak – custom duration (e.g. 2 hours)
.\k6\run-tests.ps1 -Test soak -SoakDuration 2h

# Breakpoint – find the breaking point (auto-aborts)
.\k6\run-tests.ps1 -Test breakpoint

# Auth flow – per-step auth latency
.\k6\run-tests.ps1 -Test auth

# Booking concurrency – race condition detection
.\k6\run-tests.ps1 -Test concurrency

# Run smoke + load + stress sequentially
.\k6\run-tests.ps1 -Test all

# Point at a different environment
.\k6\run-tests.ps1 -Test load -BaseUrl http://staging.myapp.com
```

### Via Docker Compose (tests run inside the network)

```bash
# Start the full stack first
docker compose up -d

# Then run any test via the k6 service
docker compose --profile perf run --rm k6 smoke
docker compose --profile perf run --rm k6 load
docker compose --profile perf run --rm k6 stress
docker compose --profile perf run --rm k6 spike
docker compose --profile perf run --rm k6 soak
docker compose --profile perf run --rm k6 breakpoint
docker compose --profile perf run --rm k6 auth
docker compose --profile perf run --rm k6 concurrency
```

---

## Test Descriptions

| # | Test | VUs | Duration | Purpose |
|---|------|-----|----------|---------|
| 01 | **Smoke** | 1 | ~30 s | Verify all endpoints are alive after a deploy |
| 02 | **Load** | 50 | ~14 min | Simulate normal daily traffic with realistic distribution |
| 03 | **Stress** | 200 | ~12 min | Find degradation point; observe error behavior |
| 04 | **Spike** | 300 | ~6 min | Simulate two flash-sale bursts; test rate limiters |
| 05 | **Soak** | 25 | 30 min+ | Detect memory leaks, connection exhaustion, degradation |
| 06 | **Breakpoint** | 300 | ~19 min | Auto-abort when error rate > 10% or p95 > 5 s |
| 07 | **Auth Flow** | 40 | ~8 min | Benchmark each auth step: signup → login → refresh → logout |
| 08 | **Concurrency** | 100 | ~6 min | Race-condition detection for concurrent bookings |

---

## Traffic Distribution (Load Test)

| Scenario | % of Requests |
|----------|--------------|
| Flight Search | 60% |
| Hotel Search  | 55% |
| Flight Booking | 15% |
| Hotel Booking  | 10% |

> Percentages are independent, so a single VU iteration may trigger multiple scenarios.

---

## Thresholds / SLAs

Three threshold presets are defined in `config/thresholds.js`:

| Preset | http_req_failed | p(95) | p(99) | checks |
|--------|----------------|-------|-------|--------|
| `DEFAULT_THRESHOLDS` | < 1% | < 2000 ms | < 4000 ms | > 95% |
| `STRICT_THRESHOLDS`  | < 0.5% | < 800 ms | < 1500 ms | > 99% |
| `RELAXED_THRESHOLDS` | < 5% | < 5000 ms | < 10000 ms | > 90% |

---

## Custom Metrics

Each test tracks scenario-specific metrics beyond the built-in k6 metrics:

| Metric | Test | Description |
|--------|------|-------------|
| `flight_search_duration` | Load | p95 latency for flight searches |
| `hotel_search_duration` | Load | p95 latency for hotel searches |
| `flight_booking_duration` | Load | p95 latency for flight bookings |
| `hotel_booking_duration` | Load | p95 latency for hotel bookings |
| `search_cache_hit_rate` | Load | Estimated Redis cache hit rate |
| `stress_error_rate` | Stress | Error % under overload |
| `request_timeouts` | Stress | Total timeout count |
| `spike_recovery_time_ms` | Spike | Individual request time during/after spike |
| `rate_limited_requests` | Spike | Count of HTTP 429 responses |
| `soak_early_p95` | Soak | p95 in first 10 minutes (baseline) |
| `soak_late_p95` | Soak | p95 after 20 minutes (degradation check) |
| `auth_signup_duration` | Auth | bcrypt/signup latency |
| `auth_login_duration` | Auth | JWT generation latency |
| `auth_token_refresh_duration` | Auth | Token refresh latency |
| `concurrent_successful_bookings` | Concurrency | Successful books under contention |
| `concurrent_conflict_errors` | Concurrency | 409 responses (healthy!) |
| `potential_data_corruption` | Concurrency | 5xx during write = suspicious |

---

## Results

JSON result files are saved to `k6/results/` with timestamped filenames:

```
k6/results/
  smoke_20260724_163000.json
  load_20260724_163200.json
  ...
```

Use [k6 Cloud](https://app.k6.io) or [Grafana k6](https://grafana.com/docs/k6/) to visualize results.