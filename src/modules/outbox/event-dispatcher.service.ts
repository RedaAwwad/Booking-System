import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { PublisherService } from './publisher.service';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxMessage } from './entities/outbox-message.entity';

@Injectable()
export class EventDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventDispatcherService.name);
  private queryRunner: QueryRunner;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisherService: PublisherService,
    @InjectRepository(OutboxMessage)
    private readonly outboxRepo: Repository<OutboxMessage>,
  ) { }

  async onModuleInit() {
    this.logger.log('Initializing EventDispatcherService...');

    try {
      // We need a dedicated connection for LISTEN
      this.queryRunner = this.dataSource.createQueryRunner();
      await this.queryRunner.connect();

      // Access the raw pg.Client
      const pgClient = (this.queryRunner as any).databaseConnection;

      if (pgClient && typeof pgClient.on === 'function') {
        pgClient.on('notification', async (msg) => {
          if (msg.channel === 'outbox_channel') {
            try {
              const payload = JSON.parse(msg.payload);
              this.logger.log(`Received notification for outbox record [${payload.id}]`);
              await this.publisherService.publishRecord(payload);
            } catch (e) {
              this.logger.error('Failed to process outbox notification', e);
            }
          }
        });

        await this.queryRunner.query(`LISTEN outbox_channel`);
        this.logger.log('Listening to outbox_channel');
      } else {
        this.logger.warn('Underlying database driver does not support notification events or could not be accessed.');
      }

      // Process any bootstrap messages that might have been created while the app was down
      await this.processBootstrapMessages();
    } catch (e) {
      this.logger.error('Failed to initialize EventDispatcherService', e);
    }
  }

  async processBootstrapMessages() {
    this.logger.log('Processing bootstrap outbox messages...');
    try {
      const records = await this.dataSource.query(`SELECT * FROM outbox_messages WHERE status = 'READY' ORDER BY created_at ASC`);
      for (const record of records) {
        await this.publisherService.publishRecord(record);
      }
    } catch (e) {
      this.logger.error('Failed to process bootstrap outbox messages', e);
    }
  }

  async onModuleDestroy() {
    if (this.queryRunner && !this.queryRunner.isReleased) {
      await this.queryRunner.release();
    }
  }
}

/*

// ENHANCED VERSION — pending team review
// New imports needed:
//   import { Client } from 'pg';
//   import { OutboxMessage } from './entities/outbox-message.entity';

export class EventDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventDispatcherService.name);
  private queryRunner: QueryRunner;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisherService: PublisherService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing EventDispatcherService...');
    await this.setupListener();
  }

  // Extracted into its own method so reconnection can call it again
  private async setupListener() {
    try {
      // Create a dedicated connection — LISTEN must not share the general query pool
      this.queryRunner = this.dataSource.createQueryRunner();

      // connect() returns the raw pg.Client (TypeORM public API — Promise<any>)
      const pgClient: Client = await this.queryRunner.connect();

      if (!pgClient || typeof pgClient.on !== 'function') {
        // This should never happen with a Postgres driver, but guard anyway
        this.logger.error(
          'Cannot access raw pg.Client — LISTEN/NOTIFY will not work. ' +
          'Ensure you are using the pg (PostgreSQL) driver.',
        );
        return; // Bail out early — do not bootstrap either
      }

      // --- Connection loss handlers ---
      // If the socket errors, log it. The 'end' event will fire afterwards.
      pgClient.on('error', (err) => {
        this.logger.error('pg connection error', err);
      });

      // If the connection drops (network blip, Postgres restart, etc.),
      // release the broken runner and re-run the full setup after a short delay
      pgClient.on('end', () => {
        this.logger.warn('pg connection ended unexpectedly. Reconnecting in 5s...');
        this.queryRunner.release().catch(() => {});
        setTimeout(() => this.setupListener(), 5000);
      });

      // --- Notification handler ---
      // Synchronous callback — avoid async on EventEmitter to prevent silent unhandled rejections
      pgClient.on('notification', (msg) => {
        // msg.payload is string | undefined — guard before JSON.parse
        if (msg.channel !== 'outbox_channel' || !msg.payload) return;

        let raw: any;
        try {
          raw = JSON.parse(msg.payload);
        } catch {
          this.logger.error('Failed to parse notification payload', msg.payload);
          return;
        }

        // Map the raw snake_case pg_notify payload to a typed OutboxMessage
        // at this boundary — the single place where format conversion happens
        const record = this.mapRawToEntity(raw);
        this.logger.log(`Received notification for outbox record [${record.id}]`);

        // Fire-and-forget with explicit error handling via .catch()
        this.publisherService
          .publishRecord(record)
          .catch((e) => this.logger.error('Failed to publish outbox record', e));
      });

      // Send LISTEN only after all handlers are registered
      await this.queryRunner.query(`LISTEN outbox_channel`);
      this.logger.log('Successfully listening on outbox_channel');

      // Bootstrap only runs after LISTEN is confirmed active
      // This handles any READY records that arrived while the app was down
      await this.processBootstrapMessages();
    } catch (e) {
      this.logger.error('Failed to initialize EventDispatcherService', e);
    }
  }

  private async processBootstrapMessages() {
    this.logger.log('Processing bootstrap outbox messages...');
    try {
      const records = await this.outboxRepo.find({
        where: { status: OutboxStatus.READY },
        order: { createdAt: 'ASC' },
      });
      for (const record of records) {
        await this.publisherService.publishRecord(record);
      }
    } catch (e) {
      this.logger.error('Failed to process bootstrap outbox messages', e);
    }
  }

  
  //  * Maps a raw database row (snake_case columns from pg_notify or raw SQL)
  //  * to a typed OutboxMessage entity (camelCase properties).
  //  *
  //  * Both pg_notify payloads (row_to_json) and dataSource.query() results
  //  * use database column names (snake_case). This helper is the single
  //  * conversion point — keeping format logic out of business logic.
   
  private mapRawToEntity(raw: any): OutboxMessage {
    const entity = new OutboxMessage();
    entity.id           = raw.id;
    entity.exchangeName = raw.exchange_name;
    entity.routingKey   = raw.routing_key;
    entity.payload      = raw.payload;
    entity.status       = raw.status;
    entity.failedAt     = raw.failed_at ? new Date(raw.failed_at) : null;
    entity.createdAt    = raw.created_at ? new Date(raw.created_at) : null;
    return entity;
  }

  async onModuleDestroy() {
    if (this.queryRunner && !this.queryRunner.isReleased) {
      await this.queryRunner.release();
    }
  }
}

*/