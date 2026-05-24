import { createHash } from 'crypto';

/**
 * Builds a deterministic SHA-256 cache key from any query object.
 * Keys are sorted before hashing so param order never produces different keys.
 *
 * @example
 * buildCacheKey('flights', { origin: 'LHR', destination: 'JFK' })
 * // => 'flights:a3f2...'
 */
export function buildCacheKey(prefix: string, query: object): string {
  const sorted = Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const hash = createHash('sha256')
    .update(JSON.stringify(sorted))
    .digest('hex');
  return `${prefix}:${hash}`;
}
