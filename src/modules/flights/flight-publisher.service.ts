import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, Publisher } from 'rabbitmq-client';
import { FlightOutboxMessage, OutboxStatus } from './entities/flight-outbox-message.entity';

@Injectable()
export class FlightPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FlightPublisherService.name);
  private connection: Connection;
  private publisher: Publisher;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(FlightOutboxMessage)
    private readonly outboxRepo: Repository<FlightOutboxMessage>,
  ) {}

  onModuleInit() {
    const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
    this.connection = new Connection(url);

    this.connection.on('error', (err) => {
      this.logger.error('RabbitMQ connection error in FlightPublisherService', err);
    });

    this.connection.on('connection', () => {
      this.logger.log('RabbitMQ connection established for FlightPublisherService');
    });

    this.publisher = this.connection.createPublisher({
      confirm: true,
      maxAttempts: 2,
    });
  }

  async publishRecord(record: FlightOutboxMessage) {
    try {
      let exchangeName = '';
      let routingKey = '';

      if (record.payload.kind === 'audit') {
        exchangeName = this.configService.getOrThrow<string>('AUDIT_EXCHANGE');
        routingKey = this.configService.getOrThrow<string>('AUDIT_ROUTING_KEY');
      } else if (record.payload.kind === 'notification') {
        exchangeName = this.configService.getOrThrow<string>('NOTIFICATIONS_EXCHANGE');
        routingKey = this.configService.getOrThrow<string>('NOTIFICATIONS_ROUTING_KEY');
      }

      this.logger.log(`Publishing record [${record.id}] to exchange [${exchangeName}]`);

      await this.publisher.send(
        { exchange: exchangeName, routingKey },
        record.payload,
      );

      // On success, delete the record
      await this.outboxRepo.delete(record.id);
      this.logger.log(`Published and deleted flight outbox record [${record.id}]`);
    } catch (e) {
      this.logger.error(`Failed to publish flight outbox record [${record.id}]`, e);
      // On failure, update status to FAILED
      await this.outboxRepo.update(record.id, {
        status: OutboxStatus.FAILED,
        failedAt: new Date(),
      });
    }
  }

  async onModuleDestroy() {
    if (this.publisher) {
      await this.publisher.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}
