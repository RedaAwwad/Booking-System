/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 3 – STRESS TEST (beyond normal capacity)
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Push the system beyond its expected limits to find the breaking
 *           point and observe how it degrades. Ramps up to 200 VUs in steps.
 *
 * Run     : k6 run k6/tests/03-stress.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, authHeaders, buildQueryString, randomFlightSearch,
  randomHotelSearch, randomFlightBooking, randomHotelBooking
} from '../helpers/utils.js';
import { RELAXED_THRESHOLDS } from '../config/thresholds.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
const errorRate = new Rate('stress_error_rate');
const p99Duration = new Trend('stress_p99_duration', true);
const concurrentBookings = new Counter('concurrent_booking_attempts');
const timeoutCount = new Counter('request_timeouts');

export const options = {
  stages: [
    { duration: '1m', target: 20 }, // warm-up
    { duration: '2m', target: 50 }, // normal load
    { duration: '2m', target: 100 }, // approaching limit
    { duration: '2m', target: 150 }, // above normal capacity
    { duration: '2m', target: 200 }, // maximum stress
    { duration: '1m', target: 200 }, // hold at max
    { duration: '2m', target: 0 }, // recovery ramp-down
  ],

  thresholds: {
    ...RELAXED_THRESHOLDS,
    stress_error_rate: ['rate<0.15'],   // up to 15 % errors allowed under stress
    stress_p99_duration: ['p(99)<10000'], // 99th pct under 10 s
    request_timeouts: ['count<100'],
  },
};

// ─── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  const users = [];
  for (let i = 0; i < 10; i++) {
    const email = `stress_user_${Date.now()}_${i}@test.local`;
    const password = 'Test@1234!';

    const signupRes = http.post(
      `${BASE_URL}/auth/signup`,
      JSON.stringify({ firstName: 'Stress', lastName: `U${i}`, email, password, phone: '+10000000001' }),
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
          accessToken: body.data?.accessToken,
          userId: body.data?.user?.id,
        });
      }
    }
  }
  console.log(`Stress test – ${users.length} users ready.`);
  return { users };
}

// ─── Main iteration ─────────────────────────────────────────────────────────
export default function ({ users }) {
  const user = users[Math.floor(Math.random() * users.length)];
  const headers = authHeaders(user.accessToken);

  const scenario = Math.random();

  if (scenario < 0.40) {
    // Heavy flight search burst
    group('Flight Search Burst', () => {
      // Send 2 searches back-to-back to stress the scatter-gather layer
      for (let i = 0; i < 2; i++) {
        const q = randomFlightSearch();
        const url = `${BASE_URL}/flights?` + buildQueryString(q);
        const res = http.get(url, { headers, timeout: '15s' });

        p99Duration.add(res.timings.duration);

        const ok = check(res, {
          'stress flight search: not 500': (r) => r.status < 500,
          'stress flight search: not timeout': (r) => r.status !== 0,
        });

        errorRate.add(!ok);
        if (res.status === 0) timeoutCount.add(1);
        sleep(0.2);
      }
    });

  } else if (scenario < 0.70) {
    // Hotel search
    group('Hotel Search Burst', () => {
      for (let i = 0; i < 2; i++) {
        const q = randomHotelSearch();
        const url = `${BASE_URL}/hotels?` + buildQueryString(q);
        const res = http.get(url, { headers, timeout: '15s' });

        p99Duration.add(res.timings.duration);

        const ok = check(res, {
          'stress hotel search: not 500': (r) => r.status < 500,
        });
        errorRate.add(!ok);
        if (res.status === 0) timeoutCount.add(1);
        sleep(0.2);
      }
    });

  } else if (scenario < 0.85) {
    // Flight booking under stress
    group('Concurrent Flight Booking', () => {
      concurrentBookings.add(1);
      const dto = randomFlightBooking(user.userId, user.email);
      const res = http.post(
        `${BASE_URL}/flights`,
        JSON.stringify(dto),
        { headers, timeout: '20s' },
      );
      p99Duration.add(res.timings.duration);
      const ok = check(res, {
        'stress flight booking: not 500': (r) => r.status < 500,
        'stress flight booking: accepted': (r) => r.status === 200 || r.status === 201 || r.status === 429,
      });
      errorRate.add(!ok);
      if (res.status === 0) timeoutCount.add(1);
    });

  } else {
    // Hotel booking under stress
    group('Concurrent Hotel Booking', () => {
      concurrentBookings.add(1);
      const dto = randomHotelBooking(user.userId, user.email);
      const res = http.post(
        `${BASE_URL}/hotels`,
        JSON.stringify(dto),
        { headers, timeout: '20s' },
      );
      p99Duration.add(res.timings.duration);
      const ok = check(res, {
        'stress hotel booking: not 500': (r) => r.status < 500,
      });
      errorRate.add(!ok);
      if (res.status === 0) timeoutCount.add(1);
    });
  }

  // Minimal think time under stress – realistic "panic buying" behavior
  sleep(Math.random() * 0.5);
}

export function teardown({ users }) {
  for (const user of users) {
    if (user.accessToken) {
      http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders(user.accessToken) });
    }
  }
}
