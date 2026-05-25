import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightsModule } from './modules/flights/flights.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { CacheModule } from './common/cache/cache.module';
import { DatabaseModule } from './common/database/database.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CacheModule,
    TransactionsModule,
    OutboxModule,
    NotificationsModule,
    FlightsModule,
    HotelsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
