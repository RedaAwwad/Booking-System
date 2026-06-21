import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, Consumer } from 'rabbitmq-client';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus } from '../../transactions/entities/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationStatus,
} from '../entities/notification.entity';
import { NotificationPayload } from '../../outbox/types/outbox-payload.type';

@Injectable()
export class NotificationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationWorkerService.name);
  private connection: Connection;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly transactionsService: TransactionsService,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  onModuleInit() {
    const url        = this.configService.getOrThrow<string>('RABBITMQ_URL');
    const exchange   = this.configService.getOrThrow<string>('NOTIFICATIONS_EXCHANGE');
    const queue      = this.configService.getOrThrow<string>('NOTIFICATIONS_ROUTING_KEY');
    const routingKey = this.configService.getOrThrow<string>('NOTIFICATIONS_ROUTING_KEY');

    this.connection = new Connection(url);

    this.connection.on('error', (err) => {
      this.logger.error('RabbitMQ connection error in Worker', err);
    });

    this.connection.on('connection', () => {
      this.logger.log(
        'RabbitMQ connection established for NotificationWorkerService',
      );
    });

    this.consumer = this.connection.createConsumer(
      {
        queue,
        queueOptions: { durable: true },
        qos: { prefetchCount: 10 },
        exchanges: [{ exchange, type: 'direct' }],
        queueBindings: [{ exchange, routingKey }],
      },
      async (msg) => {
        const payload = msg.body as NotificationPayload;
        this.logger.log(
          `Received notification task: ${JSON.stringify(payload)}`,
        );
        await this.handleNotification(payload);
      },
    );

    this.consumer.on('error', (err) => {
      this.logger.error('RabbitMQ consumer error', err);
    });
  }

  private async handleNotification(payload: NotificationPayload) {
    const notification = this.notificationRepo.create({
      transactionId: payload.transactionId,
      type: payload.type,
      recipient: payload.recipient,
      subject: payload.subject,
      content: payload.content,
      status: NotificationStatus.PENDING,
    });

    try {
      if (payload.type === 'EMAIL') {
        await this.emailService.send(
          payload.recipient,
          payload.subject ?? '',
          payload.content,
        );
      } else if (payload.type === 'SMS') {
        await this.smsService.send(payload.recipient, payload.content);
      } else {
        throw new Error(`Unknown notification type: ${String(payload.type)}`);
      }

      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      await this.notificationRepo.save(notification);

      if (payload.transactionId) {
        await this.transactionsService.updateStatus(
          payload.transactionId,
          TransactionStatus.PAID,
        );
      }
    } catch (e) {
      notification.status = NotificationStatus.FAILED;
      notification.error = (e as Error).message;
      await this.notificationRepo.save(notification);

      if (payload.transactionId) {
        await this.transactionsService.updateStatus(
          payload.transactionId,
          TransactionStatus.FAILED,
        );
      }

      // Re-throw so rabbitmq-client nacks the message and it can be retried/dead-lettered
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
