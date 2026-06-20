import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { AuditAction } from '../audit-action.enum';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100, name: 'entity_name' })
  entityName: string;

  @Column({ type: 'varchar', length: 255, name: 'entity_id', nullable: true })
  entityId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
