import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, Consumer } from 'rabbitmq-client';
import { AuditLog } from './entities/audit-log.entity';
import { AuditPayload } from '../outbox/types/outbox-payload.type';

/** Postgres unique-constraint violation error code. */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === PG_UNIQUE_VIOLATION
  );
}

@Injectable()
export class AuditConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumerService.name);
  private connection: Connection;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  onModuleInit() {
    const url        = this.configService.getOrThrow<string>('RABBITMQ_URL');
    const exchange   = this.configService.getOrThrow<string>('AUDIT_EXCHANGE');
    const queue      = this.configService.getOrThrow<string>('AUDIT_QUEUE');
    const routingKey = this.configService.getOrThrow<string>('AUDIT_ROUTING_KEY');

    this.connection = new Connection(url);

    this.connection.on('error', (err) => {
      this.logger.error('RabbitMQ connection error in AuditConsumerService', err);
    });

    this.connection.on('connection', () => {
      this.logger.log('RabbitMQ connection established for AuditConsumerService');
    });

    this.consumer = this.connection.createConsumer(
      {
        queue,
        queueOptions: { durable: true },
        qos: { prefetchCount: 10 },
        exchanges: [{ exchange, type: 'topic' }],
        queueBindings: [{ exchange, routingKey }],
      },
      async (msg) => {
        const payload = msg.body as AuditPayload;
        this.logger.log(
          `Received audit event [${payload.correlationId}] — ${payload.action}`,
        );
        await this.handleAuditEvent(payload);
      },
    );

    this.consumer.on('error', (err) => {
      this.logger.error('RabbitMQ consumer error in AuditConsumerService', err);
    });
  }

  private async handleAuditEvent(payload: AuditPayload): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        correlationId:  payload.correlationId,
        eventType:      payload.eventType,
        entityType:     payload.entityType,
        entityId:       payload.entityId,
        action:         payload.action,
        performedBy:    payload.performedBy,
        oldValue:       payload.oldValue   ?? null,
        newValue:       payload.newValue   ?? null,
        metadata:       payload.metadata   ?? null,
        eventTimestamp: new Date(payload.timestamp),
      });

      await this.auditLogRepo.save(log);
      this.logger.log(`Audit log saved [${payload.correlationId}]`);
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Message was redelivered — idempotent ack, nothing to do
        this.logger.warn(
          `Duplicate audit event [${payload.correlationId}] — skipping`,
        );
        return;
      }
      // Unknown error (DB down, etc.) — re-throw so rabbitmq-client nacks the message
      throw e;
    }
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}
