import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import type { FlightOutboxEvent } from '../types/flight-outbox-event.type';

export enum OutboxStatus {
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('flight_outbox_messages')
export class FlightOutboxMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  payload: FlightOutboxEvent;

  @Column({ type: 'varchar', length: 50, default: OutboxStatus.READY })
  status: string;

  @Column({ type: 'timestamp', nullable: true, name: 'failed_at' })
  failedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
