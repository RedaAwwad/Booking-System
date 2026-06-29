import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import type { HotelOutboxEvent } from '../types/hotel-outbox-event.type';

export enum OutboxStatus {
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('hotel_outbox_messages')
export class HotelOutboxMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  payload: HotelOutboxEvent;

  @Column({ type: 'varchar', length: 50, default: OutboxStatus.READY })
  status: string;

  @Column({ type: 'timestamp', nullable: true, name: 'failed_at' })
  failedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
