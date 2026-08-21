/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 6 – BREAKPOINT TEST (capacity planning / find max throughput)
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Incrementally increase load until the system breaks (>10 % error
 *           rate OR p95 > 5 s). Records the VU count at the break point.
 *           Use this to determine horizontal scaling thresholds.
 *
 * Run     : k6 run k6/tests/06-breakpoint.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http  from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, authHeaders, buildQueryString, randomFlightSearch, randomHotelSearch } from '../helpers/utils.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
const breakpointErrorRate = new Rate('breakpoint_error_rate');
const breakpointP95       = new Trend('breakpoint_p95', true);
const errorsAt100vus      = new Counter('errors_at_100_vus');
const errorsAt200vus      = new Counter('errors_at_200_vus');
const errorsAt300vus      = new Counter('errors_at_300_vus');

export const options = {
  // Gradually step up until something breaks
  stages: [
    { duration: '2m',  target: 50  },
    { duration: '1m',  target: 50  }, // hold
    { duration: '2m',  target: 100 },
    { duration: '1m',  target: 100 }, // hold
    { duration: '2m',  target: 150 },
    { duration: '1m',  target: 150 }, // hold
    { duration: '2m',  target: 200 },
    { duration: '1m',  target: 200 }, // hold
    { duration: '2m',  target: 250 },
    { duration: '1m',  target: 250 }, // hold
    { duration: '2m',  target: 300 },
    { duration: '2m',  target: 300 }, // hold at max
    { duration: '2m',  target: 0   }, // cool-down
  ],

  // Do NOT abort on threshold failure – we WANT to observe the break
  thresholds: {
    breakpoint_error_rate: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '1m' }],
    breakpoint_p95:        [{ threshold: 'p(95)<5000', abortOnFail: true, delayAbortEval: '1m' }],
  },
};

// ─── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  const users = [];
  for (let i = 0; i < 10; i++) {
    const email    = `breakpoint_user_${Date.now()}_${i}@test.local`;
    const password = 'Test@1234!';

    const signupRes = http.post(
      `${BASE_URL}/auth/signup`,
      JSON.stringify({ firstName: 'BP', lastName: `U${i}`, email, password, phone: '+10000000001' }),
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
          accessToken: body.data?.accessToken,
          userId:      body.data?.user?.id,
        });
      }
    }
  }
  return { users };
}

// ─── Main iteration ─────────────────────────────────────────────────────────
export default function ({ users }) {
  const user    = users[Math.floor(Math.random() * users.length)];
  const headers = authHeaders(user.accessToken);

  // Alternate between flight and hotel searches (read-heavy = more realistic)
  const isHotel = Math.random() < 0.5;
  let res;

  if (isHotel) {
    const q = randomHotelSearch();
    res = http.get(`${BASE_URL}/hotels?` + buildQueryString(q), { headers });
  } else {
    const q = randomFlightSearch();
    res = http.get(`${BASE_URL}/flights?` + buildQueryString(q), { headers });
  }

  breakpointP95.add(res.timings.duration);

  const ok = check(res, {
    'breakpoint: not 5xx':    (r) => r.status < 500,
    'breakpoint: not timeout': (r) => r.status !== 0,
  });

  breakpointErrorRate.add(!ok);

  // Track errors at specific VU counts (approximated by iteration timing)
  const currentVUs = __VU;
  if (!ok) {
    if (currentVUs >= 100 && currentVUs < 200) errorsAt100vus.add(1);
    if (currentVUs >= 200 && currentVUs < 300) errorsAt200vus.add(1);
    if (currentVUs >= 300)                     errorsAt300vus.add(1);
  }

  sleep(Math.random() * 0.5 + 0.1);
}
