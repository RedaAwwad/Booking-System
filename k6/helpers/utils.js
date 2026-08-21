/**
 * Shared helpers – base URL resolution, auth tokens, random data generators.
 */

// ─── Base URL ──────────────────────────────────────────────────────────────
// Override via K6_BASE_URL environment variable when running:
//   k6 run -e K6_BASE_URL=http://staging.example.com ...
const rawBase = __ENV.K6_BASE_URL || 'http://localhost:8080';
export const BASE_URL = rawBase.endsWith('/api/v1')
  ? rawBase
  : `${rawBase.replace(/\/+$/, '')}/api/v1`;

export function buildQueryString(params) {
  return Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
}

// ─── Auth helpers ──────────────────────────────────────────────────────────

/**
 * Register a brand-new user and return their credentials.
 * Uses the k6 http module synchronously (called in setup() functions).
 */
export function registerUser(http, suffix = '') {
  const email = `perf_user_${Date.now()}_${Math.floor(Math.random() * 100000)}_${suffix}@test.local`;
  const password = 'TestPassword123!';

  const res = http.post(
    `${BASE_URL}/auth/signup`,
    JSON.stringify({
      name: `Perf User ${suffix}`,
      email,
      phone: '+10000000001',
      password,
      passwordConfirmation: password,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status !== 201 && res.status !== 200) {
    console.error(`signup failed (${res.status}): ${res.body}`);
    return null;
  }

  return { email, password };
}

/**
 * Login with given credentials and return the access token + user object.
 */
export function loginUser(http, email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status !== 200 && res.status !== 201) {
    console.error(`login failed (${res.status}): ${res.body}`);
    return null;
  }

  try {
    const body = JSON.parse(res.body);
    return {
      accessToken: body.data?.accessToken,
      user: body.data?.user,
    };
  } catch (e) {
    console.error('Could not parse login response:', res.body);
    return null;
  }
}

/**
 * Log in a batch of pre-seeded users (created via npm run seed:users).
 * Fast-tracks setup by bypassing the signup/bcrypt hashing bottleneck.
 */
export function getSeededUserBatch(http, count = 100, password = 'SeedPassword123!') {
  const users = [];
  for (let i = 1; i <= count; i++) {
    const email = `perf_user_${i}@test.local`;
    const auth = loginUser(http, email, password);
    if (auth && auth.accessToken) {
      users.push({
        email,
        accessToken: auth.accessToken,
        userId: auth.user?.id || auth.user?.userId,
      });
    }
  }
  return users;
}

/**
 * Return common JSON + Auth headers given an access token.
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ─── Random data generators ────────────────────────────────────────────────

const AIRPORTS = ['LHR', 'JFK', 'DXB', 'CDG', 'SIN', 'ORD', 'LAX', 'FRA', 'AMS', 'HKG'];
const CABIN_CLASSES = ['economy', 'business', 'first'];
const CITIES = ['New York', 'London', 'Paris', 'Tokyo', 'Dubai', 'Sydney', 'Berlin', 'Toronto'];
const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'executive'];
const PAYMENT_METHODS = ['credit_card', 'paypal', 'bank_transfer'];

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Return a departure date 30–90 days from today (YYYY-MM-DD). */
export function futureDateString(minDays = 30, maxDays = 90) {
  const d = new Date();
  d.setDate(d.getDate() + minDays + Math.floor(Math.random() * (maxDays - minDays)));
  return d.toISOString().split('T')[0];
}

export function randomFlightSearch() {
  const allAirports = [...AIRPORTS];
  const originIdx = Math.floor(Math.random() * allAirports.length);
  const origin = allAirports.splice(originIdx, 1)[0];
  const destination = randomItem(allAirports);

  return {
    origin,
    destination,
    departure_date: futureDateString(),
    cabin_class: randomItem(CABIN_CLASSES),
    adults_count: Math.floor(Math.random() * 3) + 1,
    limit: 10,
  };
}

export function randomHotelSearch() {
  const checkIn = futureDateString(7, 30);
  const checkOut = (() => {
    const d = new Date(checkIn);
    d.setDate(d.getDate() + Math.floor(Math.random() * 7) + 1);
    return d.toISOString().split('T')[0];
  })();

  return {
    city: randomItem(CITIES),
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults_count: Math.floor(Math.random() * 4) + 1,
    rooms_count: 1,
    limit: 10,
  };
}

export function randomFlightBooking(userId, userEmail) {
  const airports = [...AIRPORTS];
  const originIdx = Math.floor(Math.random() * airports.length);
  const origin = airports.splice(originIdx, 1)[0];

  return {
    userId,
    userEmail,
    origin,
    destination: randomItem(airports),
    departureDate: futureDateString(),
    cabinClass: randomItem(CABIN_CLASSES),
    adultsCount: Math.floor(Math.random() * 3) + 1,
    totalPrice: +(Math.random() * 1500 + 200).toFixed(2),
    currency: 'USD',
    paymentMethod: randomItem(PAYMENT_METHODS),
  };
}

export function randomHotelBooking(userId, userEmail) {
  const checkIn = futureDateString(7, 30);
  const checkOut = (() => {
    const d = new Date(checkIn);
    d.setDate(d.getDate() + Math.floor(Math.random() * 7) + 1);
    return d.toISOString().split('T')[0];
  })();

  return {
    userId,
    userEmail,
    hotelId: `hotel_${Math.floor(Math.random() * 10000)}`,
    checkIn,
    checkOut,
    roomType: randomItem(ROOM_TYPES),
    guestsCount: Math.floor(Math.random() * 4) + 1,
    totalPrice: +(Math.random() * 800 + 80).toFixed(2),
    currency: 'USD',
    paymentMethod: randomItem(PAYMENT_METHODS),
  };
}
