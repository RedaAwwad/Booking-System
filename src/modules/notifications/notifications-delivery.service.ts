import { Injectable } from '@nestjs/common';
import { INotificationsDeliveryService } from './contracts/notifications-delivery.interface';
import { EmailService } from './email/email.service';
import { SmsService } from './sms/sms.service';

@Injectable()
export class NotificationsDeliveryService implements INotificationsDeliveryService {
  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  sendEmail(to: string, subject: string, content: string): Promise<void> {
    return this.emailService.send(to, subject, content);
  }

  sendSms(to: string, content: string): Promise<void> {
    return this.smsService.send(to, content);
  }
}
