import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { PublisherService } from './publisher.service';

@Injectable()
export class EventDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventDispatcherService.name);
  private queryRunner: QueryRunner;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisherService: PublisherService,
  ) {}

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
