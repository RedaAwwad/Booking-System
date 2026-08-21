/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 4 – SPIKE TEST (sudden traffic spikes)
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Simulate a sudden marketing campaign or a flash-sale event that
 *           drives an instantaneous surge to 300 VUs, then drops back.
 *           Tests auto-scaling, circuit breakers and rate limiters.
 *
 * Run     : k6 run k6/tests/04-spike.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  BASE_URL, authHeaders, buildQueryString, randomFlightSearch,
  randomHotelSearch, randomFlightBooking, getSeededUserBatch, registerUser, loginUser
} from '../helpers/utils.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
const spikeRecoveryTime = new Trend('spike_recovery_time_ms', true);
const rateLimitedReqs = new Counter('rate_limited_requests');
const spikeErrorRate = new Rate('spike_error_rate');

export const options = {
  stages: [
    // Baseline
    { duration: '30s', target: 10 },
    { duration: '30s', target: 10 },

    // Spike 1 – instant ramp to 300 VUs
    { duration: '10s', target: 300 },
    { duration: '1m', target: 300 },

    // Recovery back to baseline
    { duration: '30s', target: 10 },
    { duration: '30s', target: 10 },

    // Spike 2 – second wave
    { duration: '10s', target: 250 },
    { duration: '45s', target: 250 },

    // Final recovery
    { duration: '1m', target: 0 },
  ],

  thresholds: {
    // System should survive the spike even with elevated errors
    spike_error_rate: ['rate<0.25'],
    // Rate limiting (429) is acceptable – track but don't fail
    rate_limited_requests: ['count>=0'],
    // After spike, 95 pct of requests should still finish under 8 s
    http_req_duration: ['p(95)<8000'],
    http_req_failed: ['rate<0.25'],
    checks: ['rate>0.75'],
  },
};

// ─── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  // Attempt to load pre-seeded users (from npm run seed:users)
  let users = getSeededUserBatch(http, 50);
  console.log(`users count: ${users.length}`);

  if (users.length === 0) {
    console.log('Pre-seeded users not found. Falling back to dynamic user registration...');
    for (let i = 0; i < 15; i++) {
      const creds = registerUser(http, `spike_${i}`);
      if (creds) {
        const auth = loginUser(http, creds.email, creds.password);
        if (auth && auth.accessToken) {
          users.push({
            email: creds.email,
            accessToken: auth.accessToken,
            userId: auth.user?.id || auth.user?.userId,
          });
        }
      }
    }
  }

  console.log(`Spike test – ${users.length} users ready.`);
  return { users, spikeStart: Date.now() };
}

// ─── Main iteration ─────────────────────────────────────────────────────────
export default function ({ users, spikeStart }) {
  const user = users[Math.floor(Math.random() * users.length)];
  const headers = authHeaders(user.accessToken);

  const action = Math.random();

  if (action < 0.50) {
    // Flight search – most common during spike (e.g. flash sale announcement)
    group('Spike – Flight Search', () => {
      const q = randomFlightSearch();
      const url = `${BASE_URL}/flights?` + buildQueryString(q);

      const start = Date.now();
      const res = http.get(url, { headers, timeout: '30s' });
      const dur = Date.now() - start;

      if (res.status === 429) {
        rateLimitedReqs.add(1);
      }

      const ok = check(res, {
        'spike flight search: survived': (r) => r.status < 500,
        'spike flight search: not timeout': (r) => r.status !== 0,
      });
      spikeErrorRate.add(!ok);

      // Track how long individual requests took during/after spike
      spikeRecoveryTime.add(dur);
    });

  } else if (action < 0.80) {
    // Hotel search
    group('Spike – Hotel Search', () => {
      const q = randomHotelSearch();
      const url = `${BASE_URL}/hotels?` + buildQueryString(q);

      const start = Date.now();
      const res = http.get(url, { headers, timeout: '30s' });
      const dur = Date.now() - start;

      if (res.status === 429) rateLimitedReqs.add(1);

      const ok = check(res, {
        'spike hotel search: survived': (r) => r.status < 500,
      });
      spikeErrorRate.add(!ok);
      spikeRecoveryTime.add(dur);
    });

  } else {
    // Booking attempts during spike – worst-case scenario
    group('Spike – Flight Booking', () => {
      const dto = randomFlightBooking(user.userId, user.email);
      const res = http.post(
        `${BASE_URL}/flights`,
        JSON.stringify(dto),
        { headers, timeout: '30s' },
      );

      if (res.status === 429) rateLimitedReqs.add(1);

      const ok = check(res, {
        'spike booking: survived': (r) => r.status < 500,
        'spike booking: meaningful status': (r) => [200, 201, 429, 503].includes(r.status),
      });
      spikeErrorRate.add(!ok);
    });
  }

  // Minimal think time – spike simulates aggressive concurrent users
  sleep(Math.random() * 0.3);
}

export function teardown({ users }) {
  for (const user of users) {
    if (user.accessToken) {
      http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders(user.accessToken) });
    }
  }
}
