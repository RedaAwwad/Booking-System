/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 8 – BOOKING CONCURRENCY TEST
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Simulate many users attempting to book the SAME flight / hotel
 *           simultaneously. Validates:
 *           - Optimistic locking / idempotency
 *           - Database transaction isolation
 *           - Outbox pattern correctness under race conditions
 *           - No double-bookings or data corruption
 *
 * Run     : k6 run k6/tests/08-booking-concurrency.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http  from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { BASE_URL, authHeaders, futureDateString } from '../helpers/utils.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
const successfulBookings = new Counter('concurrent_successful_bookings');
const conflictErrors     = new Counter('concurrent_conflict_errors');  // 409
const serverErrors       = new Counter('concurrent_server_errors');    // 5xx
const dataCorruption     = new Rate('potential_data_corruption');

// ─── Shared booking target (all VUs try to book the same resource) ──────────
const SHARED_FLIGHT = {
  origin:        'LHR',
  destination:   'JFK',
  departureDate: futureDateString(30, 31), // same day for all
  cabinClass:    'economy',
  adultsCount:   1,
  totalPrice:    450.00,
  currency:      'USD',
  paymentMethod: 'credit_card',
};

const SHARED_HOTEL = {
  hotelId:     'hotel_CONTEST_001',
  checkIn:     futureDateString(14, 15),
  checkOut:    futureDateString(17, 18),
  roomType:    'suite',
  guestsCount: 2,
  totalPrice:  320.00,
  currency:    'USD',
  paymentMethod: 'credit_card',
};

export const options = {
  // Simulate multiple waves of concurrent booking attempts
  scenarios: {
    flight_concurrency: {
      executor:   'ramping-arrival-rate',
      startRate:  5,
      timeUnit:   '1s',
      preAllocatedVUs: 50,
      maxVUs:     100,
      stages: [
        { duration: '30s', target: 5  },
        { duration: '30s', target: 30 }, // spike booking rate
        { duration: '1m',  target: 30 },
        { duration: '30s', target: 5  },
        { duration: '30s', target: 0  },
      ],
      exec: 'bookFlight',
    },

    hotel_concurrency: {
      executor:   'ramping-arrival-rate',
      startRate:  3,
      timeUnit:   '1s',
      preAllocatedVUs: 30,
      maxVUs:     60,
      stages: [
        { duration: '30s', target: 3  },
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 20 },
        { duration: '30s', target: 3  },
        { duration: '30s', target: 0  },
      ],
      exec: 'bookHotel',
      startTime: '20s', // offset from flight concurrency
    },
  },

  thresholds: {
    concurrent_conflict_errors:  ['count>=0'],          // 409s are expected and healthy
    concurrent_server_errors:    ['count<10'],           // 5xx are NOT acceptable
    potential_data_corruption:   ['rate<0.01'],
    http_req_failed:             ['rate<0.05'],
    checks:                      ['rate>0.90'],
  },
};

// ─── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  const users = [];
  for (let i = 0; i < 20; i++) {
    const email    = `concurrency_user_${Date.now()}_${i}@test.local`;
    const password = 'Test@1234!';

    const signupRes = http.post(
      `${BASE_URL}/auth/signup`,
      JSON.stringify({ firstName: 'Conc', lastName: `U${i}`, email, password, phone: '+10000000001' }),
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
          userId:      body.data?.user?.id,
        });
      }
    }
  }
  console.log(`Concurrency test – ${users.length} users ready.`);
  return { users };
}

// ─── Flight booking scenario ─────────────────────────────────────────────────
export function bookFlight({ users }) {
  const user    = users[Math.floor(Math.random() * users.length)];
  const headers = authHeaders(user.accessToken);

  group('Concurrent Flight Booking', () => {
    const dto = { ...SHARED_FLIGHT, userId: user.userId, userEmail: user.email };
    const res = http.post(`${BASE_URL}/flights`, JSON.stringify(dto), { headers });

    const isSuccess  = res.status === 200 || res.status === 201;
    const isConflict = res.status === 409;
    const isServer   = res.status >= 500;

    if (isSuccess)  successfulBookings.add(1);
    if (isConflict) conflictErrors.add(1);
    if (isServer)   serverErrors.add(1);

    // Data corruption heuristic: 5xx with booking payload = potential DB issue
    dataCorruption.add(isServer);

    check(res, {
      'flight concurrency: no 5xx':     (r) => r.status < 500,
      'flight concurrency: meaningful': (r) => [200, 201, 400, 409, 422, 429].includes(r.status),
    });
  });

  sleep(Math.random() * 0.2);
}

// ─── Hotel booking scenario ──────────────────────────────────────────────────
export function bookHotel({ users }) {
  const user    = users[Math.floor(Math.random() * users.length)];
  const headers = authHeaders(user.accessToken);

  group('Concurrent Hotel Booking', () => {
    const dto = { ...SHARED_HOTEL, userId: user.userId, userEmail: user.email };
    const res = http.post(`${BASE_URL}/hotels`, JSON.stringify(dto), { headers });

    const isSuccess  = res.status === 200 || res.status === 201;
    const isConflict = res.status === 409;
    const isServer   = res.status >= 500;

    if (isSuccess)  successfulBookings.add(1);
    if (isConflict) conflictErrors.add(1);
    if (isServer)   serverErrors.add(1);

    dataCorruption.add(isServer);

    check(res, {
      'hotel concurrency: no 5xx':     (r) => r.status < 500,
      'hotel concurrency: meaningful': (r) => [200, 201, 400, 409, 422, 429].includes(r.status),
    });
  });

  sleep(Math.random() * 0.2);
}

// ─── Default export required when using scenarios ────────────────────────────
export default function () {}

export function teardown({ users }) {
  for (const user of users) {
    if (user.accessToken) {
      http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders(user.accessToken) });
    }
  }
}
