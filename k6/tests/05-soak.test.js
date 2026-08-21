/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 5 – SOAK TEST (endurance / memory-leak detection)
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Run a moderate load (25 VUs) for an extended period (30 min by
 *           default, configurable via K6_SOAK_DURATION env var) to detect:
 *           - Memory leaks
 *           - Connection pool exhaustion
 *           - Gradual response-time degradation
 *           - DB cursor / file handle leaks
 *
 * Run     : k6 run k6/tests/05-soak.test.js
 * Long run: k6 run -e K6_SOAK_DURATION=2h k6/tests/05-soak.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http  from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, authHeaders, buildQueryString, randomFlightSearch,
         randomHotelSearch, randomFlightBooking, randomHotelBooking } from '../helpers/utils.js';
import { DEFAULT_THRESHOLDS } from '../config/thresholds.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
// Track p95 in 5-minute windows to spot degradation over time
const earlyP95  = new Trend('soak_early_p95',  true); // first 10 min
const lateP95   = new Trend('soak_late_p95',   true); // after 20 min
const authErrors = new Counter('soak_auth_errors');
const dbErrors   = new Counter('soak_db_errors'); // 500s often signal DB issues

const SOAK_DURATION = __ENV.K6_SOAK_DURATION || '30m';
const TARGET_VUS    = parseInt(__ENV.K6_SOAK_VUS || '25', 10);

export const options = {
  stages: [
    { duration: '2m',          target: TARGET_VUS }, // warm-up
    { duration: SOAK_DURATION, target: TARGET_VUS }, // sustained load
    { duration: '2m',          target: 0          }, // cool-down
  ],

  thresholds: {
    ...DEFAULT_THRESHOLDS,
    // Early vs late degradation detection
    soak_early_p95: ['p(95)<2000'],
    soak_late_p95:  ['p(95)<3000'], // allow 50 % headroom vs early
    soak_auth_errors: ['count<10'],
    soak_db_errors:   ['count<20'],
  },
};

// ─── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  const users = [];
  for (let i = 0; i < 8; i++) {
    const email    = `soak_user_${Date.now()}_${i}@test.local`;
    const password = 'Test@1234!';

    const signupRes = http.post(
      `${BASE_URL}/auth/signup`,
      JSON.stringify({ firstName: 'Soak', lastName: `U${i}`, email, password, phone: '+10000000001' }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (signupRes.status === 200 || signupRes.status === 201) {
      const loginRes = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email, password }),
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (loginRes.status === 200 || loginRes.status === 201) {
        const body = JSON.parse(loginRes.body);
        users.push({
          email,
          password,
          accessToken: body.data?.accessToken,
          userId:      body.data?.user?.id,
          tokenMintedAt: Date.now(),
        });
      }
    }
  }
  console.log(`Soak test – ${users.length} users ready. Duration: ${SOAK_DURATION}`);
  return { users, startTime: Date.now() };
}

// ─── Token refresh helper (tokens expire during long soaks) ─────────────────
function maybeRefreshToken(user) {
  // Refresh if token is older than 20 minutes
  if (Date.now() - user.tokenMintedAt < 20 * 60 * 1000) return user;

  const res = http.post(
    `${BASE_URL}/auth/refresh-token`,
    null,
    { headers: authHeaders(user.accessToken) },
  );
  if (res.status === 200 || res.status === 201) {
    const body = JSON.parse(res.body);
    user.accessToken    = body.data?.accessToken || user.accessToken;
    user.tokenMintedAt  = Date.now();
  }
  return user;
}

// ─── Main iteration ─────────────────────────────────────────────────────────
export default function ({ users, startTime }) {
  const user    = users[Math.floor(Math.random() * users.length)];
  maybeRefreshToken(user);
  const headers  = authHeaders(user.accessToken);
  const elapsed  = Date.now() - startTime; // ms since test start
  const isEarly  = elapsed < 10 * 60 * 1000;  // first 10 min
  const isLate   = elapsed > 20 * 60 * 1000;  // after 20 min

  // ── Flight search ─────────────────────────────────────────────────────────
  group('Soak – Flight Search', () => {
    const q   = randomFlightSearch();
    const url = `${BASE_URL}/flights?` + buildQueryString(q);
    const res = http.get(url, { headers });

    if (isEarly) earlyP95.add(res.timings.duration);
    if (isLate)  lateP95.add(res.timings.duration);

    if (res.status === 401 || res.status === 403) authErrors.add(1);
    if (res.status >= 500) dbErrors.add(1);

    check(res, {
      'soak flight search: 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 3 + 1);

  // ── Hotel search ──────────────────────────────────────────────────────────
  group('Soak – Hotel Search', () => {
    const q   = randomHotelSearch();
    const url = `${BASE_URL}/hotels?` + buildQueryString(q);
    const res = http.get(url, { headers });

    if (isEarly) earlyP95.add(res.timings.duration);
    if (isLate)  lateP95.add(res.timings.duration);

    if (res.status === 401 || res.status === 403) authErrors.add(1);
    if (res.status >= 500) dbErrors.add(1);

    check(res, {
      'soak hotel search: 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 3 + 1);

  // ── Occasional booking (10 % of VU iterations) ────────────────────────────
  if (Math.random() < 0.10) {
    group('Soak – Booking', () => {
      const isHotel = Math.random() < 0.5;
      const dto     = isHotel
        ? randomHotelBooking(user.userId, user.email)
        : randomFlightBooking(user.userId, user.email);
      const url     = `${BASE_URL}/${isHotel ? 'hotels' : 'flights'}`;
      const res     = http.post(url, JSON.stringify(dto), { headers });

      if (res.status >= 500) dbErrors.add(1);
      if (res.status === 401) authErrors.add(1);

      check(res, {
        'soak booking: not 500': (r) => r.status < 500,
      });
    });
  }

  // ── Periodic profile fetch (simulates session keep-alive) ─────────────────
  if (Math.random() < 0.20) {
    const meRes = http.get(`${BASE_URL}/auth/me`, { headers });
    if (meRes.status === 401 || meRes.status === 403) authErrors.add(1);
  }

  sleep(Math.random() * 2 + 1);
}

export function teardown({ users }) {
  for (const user of users) {
    if (user.accessToken) {
      http.post(`${BASE_URL}/auth/logout-all`, null, { headers: authHeaders(user.accessToken) });
    }
  }
}
