import { v7 as uuidv7 } from 'uuid';

/**
 * Generates a UUID v7 (timestamp-based, monotonically increasing).
 *
 * Unlike v4 (random), v7 UUIDs sort chronologically, which keeps B-tree
 * index inserts sequential and avoids page splits — important for high-volume
 * tables like outbox_messages and audit_logs.
 */
export function generateUUID(): string {
  return uuidv7();
}
