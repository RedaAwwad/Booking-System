import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, Publisher } from 'rabbitmq-client';
import { OutboxMessage, OutboxStatus } from './entities/outbox-message.entity';

@Injectable()
export class PublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublisherService.name);
  private connection: Connection;
  private publisher: Publisher;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(OutboxMessage)
    private readonly outboxRepo: Repository<OutboxMessage>,
  ) {}

  onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL');
    this.connection = new Connection(url);

    this.connection.on('error', (err) => {
      this.logger.error('RabbitMQ connection error', err);
    });

    this.connection.on('connection', () => {
      this.logger.log('RabbitMQ connection established for PublisherService');
    });

    this.publisher = this.connection.createPublisher({
      confirm: true,
      maxAttempts: 2,
    });
  }

  async publishRecord(record: OutboxMessage) {
    try {
      this.logger.log(`Publishing record [${record.id}] to exchange [${record.exchangeName}]`);

      await this.publisher.send(
        { exchange: record.exchangeName, routingKey: record.routingKey },
        record.payload,
      );

      // On success, delete the record
      await this.outboxRepo.delete(record.id);
      this.logger.log(`Published and deleted outbox record [${record.id}]`);
    } catch (e) {
      this.logger.error(`Failed to publish record [${record.id}]`, e);
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
