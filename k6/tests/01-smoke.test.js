/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 1 – SMOKE TEST
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Verify the system is alive and every critical endpoint responds
 *           correctly with a minimal load (1 VU, 1 iteration each).
 *
 * Run     : k6 run k6/tests/01-smoke.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL, loginUser, registerUser, authHeaders, buildQueryString,
  randomFlightSearch, randomHotelSearch
} from '../helpers/utils.js';

export const options = {
  vus: 1,
  iterations: 1,

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.95'],
  },
};

// ─── Setup – create one user and obtain a token ─────────────────────────────
export function setup() {
  const creds = registerUser(http, 'smoke');
  if (!creds) return {};
  const auth = loginUser(http, creds.email, creds.password);
  return { ...creds, ...auth };
}

// ─── Main iteration ─────────────────────────────────────────────────────────
export default function (data) {
  const headers = authHeaders(data.accessToken || '');
  const jsonHeader = { 'Content-Type': 'application/json' };

  // 1. Auth endpoints ─────────────────────────────────────────────────────────
  group('Auth – smoke', () => {
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: data.email, password: data.password }),
      { headers: jsonHeader },
    );
    console.log(`status: ${loginRes.status}, body: ${loginRes.body}`);
    check(loginRes, {
      'login: status 200': (r) => r.status === 200 || r.status === 201,
      'login: has accessToken': (r) => !!JSON.parse(r.body)?.data?.accessToken,
    });

    const meRes = http.get(`${BASE_URL}/auth/me`, { headers });
    check(meRes, {
      'GET /auth/me: status 200': (r) => r.status === 200,
      'GET /auth/me: has email': (r) => JSON.parse(r.body)?.data?.email !== undefined || JSON.parse(r.body)?.email !== undefined,
    });
  });

  sleep(0.5);

  // 2. Flight search ──────────────────────────────────────────────────────────
  group('Flights – smoke', () => {
    const q = randomFlightSearch();
    const url = `${BASE_URL}/flights?` + buildQueryString(q);
    const res = http.get(url, { headers });
    check(res, {
      'GET /flights: status 200': (r) => r.status === 200,
      'GET /flights: body is JSON': (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // 3. Hotel search ───────────────────────────────────────────────────────────
  group('Hotels – smoke', () => {
    const q = randomHotelSearch();
    const url = `${BASE_URL}/hotels?` + buildQueryString(q);
    const res = http.get(url, { headers });
    check(res, {
      'GET /hotels: status 200': (r) => r.status === 200,
      'GET /hotels: body is JSON': (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
  });

  sleep(0.5);
}

// ─── Teardown ───────────────────────────────────────────────────────────────
export function teardown(data) {
  if (data.accessToken) {
    http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders(data.accessToken) });
  }
}
