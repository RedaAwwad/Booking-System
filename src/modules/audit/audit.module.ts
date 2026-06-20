import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AUDIT_SERVICE } from './audit.interface';

@Global()
@Module({
  providers: [
    {
      provide: AUDIT_SERVICE,
      useClass: AuditService,
    },
  ],
  exports: [AUDIT_SERVICE],
})
export class AuditModule {}
