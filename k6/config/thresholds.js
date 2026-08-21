/**
 * Shared performance thresholds / SLA definitions.
 * Import into any test scenario that needs them.
 */

export const DEFAULT_THRESHOLDS = {
  // HTTP error rate must stay below 1 %
  http_req_failed: ['rate<0.01'],

  // 95th-percentile response time under 2 s
  http_req_duration: ['p(95)<2000', 'p(99)<4000'],

  // Throughput checks – at least 95 % of checks must pass
  checks: ['rate>0.95'],
};

export const STRICT_THRESHOLDS = {
  http_req_failed:  ['rate<0.005'],
  http_req_duration: ['p(95)<800', 'p(99)<1500'],
  checks:            ['rate>0.99'],
};

export const RELAXED_THRESHOLDS = {
  http_req_failed:  ['rate<0.05'],
  http_req_duration: ['p(95)<5000', 'p(99)<10000'],
  checks:            ['rate>0.90'],
};
