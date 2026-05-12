import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  checkHealth(): { status: string; timestamp: number } {
    return {
      status: 'OK',
      timestamp: Date.now(),
    };
  }
}
