/**
 * Typed shape of the AsyncLocalStorage store used throughout the request lifecycle.
 *
 * Set at the start of each request (or service call) so that TypeORM subscribers
 * can read actor context without it being passed through every method signature.
 *
 * The `[key: symbol]: unknown` index signature is required by nestjs-cls so that
 * its internal keys can coexist with our typed keys in the same store.
 */
export interface ClsStore {
  /** The authenticated user's ID, or a system actor string ('SYSTEM', 'CRON', 'WEBHOOK'). */
  userId: string;
  [key: symbol]: unknown;
}