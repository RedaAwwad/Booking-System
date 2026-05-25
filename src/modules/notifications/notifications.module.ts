import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { EmailService } from './email/email.service';
import { SmsService } from './sms/sms.service';
import { NotificationWorkerService } from './worker/notification-worker.service';
import { NotificationsService } from './notifications.service';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    TransactionsModule,
  ],
  providers: [
    EmailService,
    SmsService,
    NotificationWorkerService,
    NotificationsService,
  ],
  exports: [EmailService, SmsService, NotificationsService],
})
export class NotificationsModule {}
