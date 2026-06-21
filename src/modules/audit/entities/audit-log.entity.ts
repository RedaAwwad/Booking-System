import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction } from '../audit-action.enum';

@Index('idx_audit_entity', ['entityType', 'entityId'])
@Index('idx_audit_created', ['createdAt'])
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID sent by the producer; unique constraint prevents duplicate inserts on redelivery. */
  @Column({ type: 'varchar', length: 36, unique: true, name: 'correlation_id' })
  correlationId: string;

  /** Dot-notation event name, e.g. 'booking.created'. */
  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  /** Class or resource name, e.g. 'FlightBooking'. */
  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'varchar', length: 255, name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  /** userId, or a system actor string: 'SYSTEM' | 'WEBHOOK' | 'CRON'. */
  @Column({ type: 'varchar', length: 255, name: 'performed_by' })
  performedBy: string;

  @Column({ type: 'jsonb', nullable: true, name: 'old_value' })
  oldValue: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'new_value' })
  newValue: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /** Wall-clock timestamp from the producer side. */
  @Column({ type: 'timestamp', name: 'event_timestamp' })
  eventTimestamp: Date;

  /** Time the consumer wrote this row — set automatically by Postgres. */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
