/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 2 – LOAD TEST (average expected traffic)
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Simulate the typical daily load of the booking system.
 *           Ramps up to 50 concurrent users over 2 min, holds for 5 min,
 *           then ramps down.
 *
 * Run     : k6 run k6/tests/02-load.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, authHeaders, buildQueryString, registerUser, loginUser, randomFlightSearch,
  randomHotelSearch, randomFlightBooking, randomHotelBooking
} from '../helpers/utils.js';
import { DEFAULT_THRESHOLDS } from '../config/thresholds.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
const flightSearchDuration = new Trend('flight_search_duration', true);
const hotelSearchDuration = new Trend('hotel_search_duration', true);
const flightBookingDuration = new Trend('flight_booking_duration', true);
const hotelBookingDuration = new Trend('hotel_booking_duration', true);
const bookingErrors = new Counter('booking_errors');
const searchCacheHits = new Rate('search_cache_hit_rate');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // ramp-up: 0 → 10 VUs
    { duration: '2m', target: 30 }, // ramp-up: 10 → 30 VUs
    { duration: '5m', target: 50 }, // ramp-up: 30 → 50 VUs (peak)
    { duration: '3m', target: 50 }, // steady state at peak
    { duration: '2m', target: 0 }, // ramp-down
  ],

  thresholds: {
    ...DEFAULT_THRESHOLDS,
    flight_search_duration: ['p(95)<2000'],
    hotel_search_duration: ['p(95)<2000'],
    flight_booking_duration: ['p(95)<3000'],
    hotel_booking_duration: ['p(95)<3000'],
    booking_errors: ['count<50'],
  },
};

// ─── Setup – pre-create a shared pool of test users ─────────────────────────
export function setup() {
  let users = getSeededUserBatch(http, 50, 'SeedPassword123!');
  if (users.length == 0) {
    console.log('Pre-seeded users not found. Falling back to dynamic user registration...');
    for (let i = 0; i < 5; i++) {
      const creds = registerUser(http, `load_${i}`);
      if (creds) {
        const auth = loginUser(http, creds.email, creds.password);
        if (auth && auth.accessToken) {
          users.push({
            email: creds.email,
            password: creds.password,
            accessToken: auth.accessToken,
            userId: auth.user?.id,
          });
        }
      }
    }
  }
  console.log(`Load test setup complete – ${users.length} users ready.`);
  return { users };
}

// ─── Main iteration ─────────────────────────────────────────────────────────
export default function ({ users }) {
  // Pick a random user from the pool (VUs share the pool)
  const user = users[Math.floor(Math.random() * users.length)];
  const headers = authHeaders(user.accessToken);

  // ── Scenario A: Browse flights (60 % of traffic) ──────────────────────────
  if (Math.random() < 0.6) {
    group('Browse Flights', () => {
      const q = randomFlightSearch();
      const url = `${BASE_URL}/flights?` + buildQueryString(q);
      const res = http.get(url, { headers, tags: { endpoint: 'flight_search' } });

      flightSearchDuration.add(res.timings.duration);

      const isOk = check(res, {
        'flight search: 200': (r) => r.status === 200,
        'flight search: has results': (r) => {
          try { return Array.isArray(JSON.parse(r.body)?.data) || JSON.parse(r.body)?.results !== undefined; }
          catch { return false; }
        },
      });

      // Detect cache header (X-Cache or similar)
      const cached = res.headers['X-Cache'] === 'HIT'
        || res.headers['x-cache-status'] === 'HIT'
        || res.timings.duration < 50; // heuristic
      searchCacheHits.add(cached);

      if (!isOk) bookingErrors.add(1);
    });
  }

  sleep(Math.random() * 2 + 0.5);

  // ── Scenario B: Browse hotels (55 % of traffic) ───────────────────────────
  if (Math.random() < 0.55) {
    group('Browse Hotels', () => {
      const q = randomHotelSearch();
      const url = `${BASE_URL}/hotels?` + buildQueryString(q);
      const res = http.get(url, { headers, tags: { endpoint: 'hotel_search' } });

      hotelSearchDuration.add(res.timings.duration);

      const isOk = check(res, {
        'hotel search: 200': (r) => r.status === 200,
        'hotel search: has results': (r) => {
          try { return JSON.parse(r.body) !== null; }
          catch { return false; }
        },
      });
      if (!isOk) bookingErrors.add(1);
    });
  }

  sleep(Math.random() * 2 + 0.5);

  // ── Scenario C: Book a flight (15 % of traffic) ───────────────────────────
  if (Math.random() < 0.15) {
    group('Book Flight', () => {
      const dto = randomFlightBooking(user.userId, user.email);
      const res = http.post(
        `${BASE_URL}/flights`,
        JSON.stringify(dto),
        { headers, tags: { endpoint: 'flight_booking' } },
      );

      flightBookingDuration.add(res.timings.duration);

      const isOk = check(res, {
        'flight booking: 201': (r) => r.status === 201 || r.status === 200,
        'flight booking: has transactionId': (r) => {
          try { return !!JSON.parse(r.body)?.transactionId || !!JSON.parse(r.body)?.data?.id; }
          catch { return false; }
        },
      });
      if (!isOk) bookingErrors.add(1);
    });
  }

  sleep(Math.random() * 2 + 0.5);

  // ── Scenario D: Book a hotel (10 % of traffic) ────────────────────────────
  if (Math.random() < 0.10) {
    group('Book Hotel', () => {
      const dto = randomHotelBooking(user.userId, user.email);
      const res = http.post(
        `${BASE_URL}/hotels`,
        JSON.stringify(dto),
        { headers, tags: { endpoint: 'hotel_booking' } },
      );

      hotelBookingDuration.add(res.timings.duration);

      const isOk = check(res, {
        'hotel booking: 201': (r) => r.status === 201 || r.status === 200,
        'hotel booking: has data': (r) => {
          try { return JSON.parse(r.body) !== null; }
          catch { return false; }
        },
      });
      if (!isOk) bookingErrors.add(1);
    });
  }

  sleep(Math.random() * 1 + 0.3);
}

export function teardown({ users }) {
  for (const user of users) {
    if (user.accessToken) {
      http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders(user.accessToken) });
    }
  }
}
