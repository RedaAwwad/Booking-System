import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum OutboxStatus {
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('outbox_messages')
export class OutboxMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'exchange_name' })
  exchangeName: string;

  @Column({ type: 'varchar', length: 255, name: 'routing_key' })
  routingKey: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'varchar', length: 50, default: OutboxStatus.READY })
  status: string;

  @Column({ type: 'timestamp', nullable: true, name: 'failed_at' })
  failedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
