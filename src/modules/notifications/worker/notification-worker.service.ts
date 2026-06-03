import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, Consumer } from 'rabbitmq-client';
import { NotificationsDeliveryService } from '../notifications-delivery.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus } from '../../transactions/contracts';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationStatus,
} from '../entities/notification.entity';

@Injectable()
export class NotificationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationWorkerService.name);
  private connection: Connection;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsDelivery: NotificationsDeliveryService,
    private readonly transactions: TransactionsService,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL');
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
        queue: 'email.notifications',
        queueOptions: { durable: true },
        qos: { prefetchCount: 10 },
        exchanges: [{ exchange: 'booking.notifications', type: 'direct' }],
        queueBindings: [
          {
            exchange: 'booking.notifications',
            routingKey: 'email.notifications',
          },
        ],
      },
      async (msg) => {
        this.logger.log(
          `Received notification task: ${JSON.stringify(msg.body)}`,
        );
        await this.handleNotification(msg.body);
      },
    );

    this.consumer.on('error', (err) => {
      this.logger.error('RabbitMQ consumer error', err);
    });
  }

  private async handleNotification(payload: any) {
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
        await this.notificationsDelivery.sendEmail(
          payload.recipient,
          payload.subject,
          payload.content,
        );
      } else if (payload.type === 'SMS') {
        await this.notificationsDelivery.sendSms(
          payload.recipient,
          payload.content,
        );
      } else {
        throw new Error(`Unknown notification type: ${payload.type}`);
      }

      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      await this.notificationRepo.save(notification);

      if (payload.transactionId) {
        await this.transactions.updateStatus(
          payload.transactionId,
          TransactionStatus.PAID,
        );
      }
    } catch (e) {
      notification.status = NotificationStatus.FAILED;
      notification.error = e.message;
      await this.notificationRepo.save(notification);

      if (payload.transactionId) {
        await this.transactions.updateStatus(
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
