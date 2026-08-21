/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST 7 – AUTH FLOW PERFORMANCE TEST
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Isolate and stress-test the authentication endpoints:
 *           signup → login → token refresh → /me → logout
 *           Useful to validate JWT throughput, Redis session storage, and
 *           bcrypt hashing limits.
 *
 * Run     : k6 run k6/tests/07-auth-flow.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http  from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL } from '../helpers/utils.js';
import { STRICT_THRESHOLDS } from '../config/thresholds.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────
const signupDuration        = new Trend('auth_signup_duration',         true);
const loginDuration         = new Trend('auth_login_duration',          true);
const tokenRefreshDuration  = new Trend('auth_token_refresh_duration',  true);
const profileDuration       = new Trend('auth_profile_duration',        true);
const logoutDuration        = new Trend('auth_logout_duration',         true);
const authFlowErrors        = new Counter('auth_flow_errors');
const duplicateEmailErrors  = new Rate('duplicate_email_rate');

let userCounter = 0; // global counter to generate unique emails per VU iteration

export const options = {
  stages: [
    { duration: '1m',  target: 10 }, // warm-up
    { duration: '3m',  target: 40 }, // ramp to 40 concurrent auth flows
    { duration: '3m',  target: 40 }, // hold
    { duration: '1m',  target: 0  }, // ramp-down
  ],

  thresholds: {
    ...STRICT_THRESHOLDS,
    auth_signup_duration:        ['p(95)<3000'],  // bcrypt is slow by design
    auth_login_duration:         ['p(95)<1000'],
    auth_token_refresh_duration: ['p(95)<500'],
    auth_profile_duration:       ['p(95)<300'],
    auth_logout_duration:        ['p(95)<500'],
    auth_flow_errors:            ['count<20'],
  },
};

// ─── Main iteration – each VU completes a full auth lifecycle ───────────────
export default function () {
  const suffix   = `${__VU}_${__ITER}_${Date.now()}`;
  const email    = `auth_flow_${suffix}@test.local`;
  const password = 'TestPassword123!';
  const jsonHdr  = { 'Content-Type': 'application/json' };

  let accessToken = null;

  // ── Step 1: Signup ────────────────────────────────────────────────────────
  group('1. Signup', () => {
    const res = http.post(
      `${BASE_URL}/auth/signup`,
      JSON.stringify({ name: 'Auth Flow User', email, phone: '+10000000002', password, passwordConfirmation: password }),
      { headers: jsonHdr },
    );
    signupDuration.add(res.timings.duration);

    const isDupe = res.status === 409;
    duplicateEmailErrors.add(isDupe);

    const ok = check(res, {
      'signup: 200 or 201': (r) => r.status === 200 || r.status === 201,
      'signup: has user':   (r) => {
        try { return !!JSON.parse(r.body)?.data; }
        catch { return false; }
      },
    });
    if (!ok && !isDupe) authFlowErrors.add(1);
  });

  sleep(0.3);

  // ── Step 2: Login ─────────────────────────────────────────────────────────
  group('2. Login', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: jsonHdr },
    );
    loginDuration.add(res.timings.duration);

    const ok = check(res, {
      'login: 200 or 201':     (r) => r.status === 200 || r.status === 201,
      'login: has accessToken': (r) => {
        try { return !!JSON.parse(r.body)?.data?.accessToken; }
        catch { return false; }
      },
    });

    if (ok) {
      accessToken = JSON.parse(res.body)?.data?.accessToken;
    } else {
      authFlowErrors.add(1);
    }
  });

  if (!accessToken) {
    console.warn(`VU ${__VU} – could not obtain token, skipping rest of flow`);
    return;
  }

  const authHdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  sleep(0.2);

  // ── Step 3: Profile fetch ─────────────────────────────────────────────────
  group('3. GET /auth/me', () => {
    const res = http.get(`${BASE_URL}/auth/me`, { headers: authHdr });
    profileDuration.add(res.timings.duration);

    const ok = check(res, {
      'GET /me: 200':        (r) => r.status === 200,
      'GET /me: has email':  (r) => {
        try { return JSON.parse(r.body)?.email !== undefined; }
        catch { return false; }
      },
    });
    if (!ok) authFlowErrors.add(1);
  });

  sleep(0.2);

  // ── Step 4: Token refresh (simulated via refresh-token endpoint) ──────────
  group('4. Refresh Token', () => {
    const res = http.post(`${BASE_URL}/auth/refresh-token`, null, { headers: authHdr });
    tokenRefreshDuration.add(res.timings.duration);

    // Refresh may 401 without cookie – that's acceptable in this test context
    check(res, {
      'refresh: not 500': (r) => r.status < 500,
    });
  });

  sleep(0.3);

  // ── Step 5: Logout ────────────────────────────────────────────────────────
  group('5. Logout', () => {
    const res = http.post(`${BASE_URL}/auth/logout`, null, { headers: authHdr });
    logoutDuration.add(res.timings.duration);

    check(res, {
      'logout: 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
  });

  sleep(Math.random() * 1 + 0.5);
}
