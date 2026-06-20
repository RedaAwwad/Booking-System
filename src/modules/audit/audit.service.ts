import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IAuditService, WriteAuditLogDto } from './audit.interface';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService implements IAuditService {
  async writeLog(em: EntityManager, payload: WriteAuditLogDto): Promise<void> {
    const log = em.create(AuditLog, {
      userId: payload.userId,
      action: payload.action,
      entityName: payload.entityName,
      entityId: payload.entityId,
    });
    await em.save(AuditLog, log);
  }
}
