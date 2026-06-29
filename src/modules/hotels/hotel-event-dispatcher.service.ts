import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from 'pg';
import { HotelOutboxMessage, OutboxStatus } from './entities/hotel-outbox-message.entity';
import { HotelPublisherService } from './hotel-publisher.service';

@Injectable()
export class HotelEventDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotelEventDispatcherService.name);
  private queryRunner: QueryRunner;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisherService: HotelPublisherService,
    @InjectRepository(HotelOutboxMessage)
    private readonly outboxRepo: Repository<HotelOutboxMessage>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing HotelEventDispatcherService...');
    
    // Schedule pg_cron job for safety-net replay
    try {
      await this.dataSource.query(`SELECT cron.unschedule('hotel-outbox-relay');`).catch(() => {});
      await this.dataSource.query(`
        SELECT cron.schedule('hotel-outbox-relay', '*/5 * * * *', $$
          DO $body$ DECLARE rec RECORD;
          BEGIN
            FOR rec IN SELECT * FROM hotel_outbox_messages WHERE status = 'READY' ORDER BY created_at ASC
            LOOP
              PERFORM pg_notify('hotel_outbox', row_to_json(rec)::text);
            END LOOP;
          END; $body$;
        $$);
      `);
      this.logger.log('Hotel outbox pg_cron job scheduled.');
    } catch (e) {
      this.logger.warn('Could not schedule hotel outbox relay via pg_cron.', e);
    }

    await this.setupListener();
  }

  private async setupListener() {
    try {
      this.queryRunner = this.dataSource.createQueryRunner();
      const pgClient: Client = await this.queryRunner.connect();

      if (!pgClient || typeof pgClient.on !== 'function') {
        this.logger.error('Cannot access raw pg.Client — LISTEN/NOTIFY will not work.');
        return;
      }

      pgClient.on('error', (err) => {
        this.logger.error('pg connection error in HotelEventDispatcherService', err);
      });

      pgClient.on('end', () => {
        this.logger.warn('pg connection ended unexpectedly. Reconnecting in 5s...');
        this.queryRunner.release().catch(() => {});
        setTimeout(() => this.setupListener(), 5000);
      });

      pgClient.on('notification', (msg) => {
        if (msg.channel !== 'hotel_outbox' || !msg.payload) return;

        let raw: any;
        try {
          raw = JSON.parse(msg.payload);
        } catch {
          this.logger.error('Failed to parse notification payload', msg.payload);
          return;
        }

        const record = this.mapRawToEntity(raw);
        this.logger.log(`Received notification for hotel outbox record [${record.id}]`);

        this.publisherService
          .publishRecord(record)
          .catch((e) => this.logger.error('Failed to publish hotel outbox record', e));
      });

      await this.queryRunner.query(`LISTEN hotel_outbox`);
      this.logger.log('Successfully listening on hotel_outbox');

      await this.processBootstrapMessages();
    } catch (e) {
      this.logger.error('Failed to initialize HotelEventDispatcherService', e);
    }
  }

  private async processBootstrapMessages() {
    this.logger.log('Processing bootstrap hotel outbox messages...');
    try {
      const records = await this.outboxRepo.find({
        where: { status: OutboxStatus.READY },
        order: { createdAt: 'ASC' },
      });
      for (const record of records) {
        await this.publisherService.publishRecord(record);
      }
    } catch (e) {
      this.logger.error('Failed to process bootstrap hotel outbox messages', e);
    }
  }

  private mapRawToEntity(raw: any): HotelOutboxMessage {
    const entity = new HotelOutboxMessage();
    entity.id = raw.id;
    entity.payload = raw.payload;
    entity.status = raw.status;
    entity.failedAt = raw.failed_at ? new Date(raw.failed_at) : null;
    entity.createdAt = raw.created_at ? new Date(raw.created_at) : new Date();
    return entity;
  }

  async onModuleDestroy() {
    if (this.queryRunner && !this.queryRunner.isReleased) {
      await this.queryRunner.release();
    }
  }
}
