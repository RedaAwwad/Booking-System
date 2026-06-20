import { EntityManager } from 'typeorm';
import { AuditAction } from './audit-action.enum';

export interface WriteAuditLogDto {
  userId: string;
  action: AuditAction;
  entityName: string;
  entityId?: string;
}

export interface IAuditService {
  writeLog(em: EntityManager, payload: WriteAuditLogDto): Promise<void>;
}

export const AUDIT_SERVICE = Symbol('AUDIT_SERVICE');
