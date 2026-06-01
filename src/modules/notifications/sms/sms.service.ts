import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, text: string): Promise<void> {
    const sid = this.configService.get<string>('SMS_ACCOUNT_SID');
    if (!sid) {
      this.logger.log(`[SMS STUB] to=${to} text="${text}"`);
      return;
    }

    // Initialize Twilio client and send here
    this.logger.log(`SMS sent to ${to}`);
  }
}
