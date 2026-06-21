import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditConsumerService } from './audit-consumer.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditConsumerService],
})
export class AuditModule {}
