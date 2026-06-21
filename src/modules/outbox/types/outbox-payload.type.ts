import { AuditAction } from '../../audit/audit-action.enum';

// ── Notification payload ────────────────────────────────────────────────────
export interface NotificationPayload {
  kind: 'notification';
  transactionId: string;
  type: 'EMAIL' | 'SMS';
  recipient: string;
  subject?: string;
  content: string;
}

// ── Audit payload ───────────────────────────────────────────────────────────
export interface AuditPayload {
  kind: 'audit';
  eventType: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  /** userId, 'SYSTEM', 'WEBHOOK', or 'CRON' */
  performedBy: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** UUID — consumer uses this for deduplication */
  correlationId: string;
  /** ISO 8601 — wall-clock time at the producer */
  timestamp: string;
}

// ── Union ───────────────────────────────────────────────────────────────────
export type OutboxPayload = NotificationPayload | AuditPayload;
