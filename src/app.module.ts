import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightsModule } from './modules/flights/flights.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { CacheModule } from './common/cache/cache.module';
import { DatabaseModule } from './common/database/database.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CustomerModule } from './modules/customer/customer.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ClsModule propagates request context (userId, etc.) through async call chains
    // via AsyncLocalStorage so TypeORM subscribers can read it without DI injection.
    ClsModule.forRoot({
      global: true,
      middleware: {
        // Automatically mounts ClsMiddleware on every HTTP route.
        // The store is initialised empty here; AuthGuard fills it on protected routes.
        mount: true,
      },
    }),
    DatabaseModule,
    CacheModule,
    TransactionsModule,
    NotificationsModule,
    AuditModule,
    FlightsModule,
    HotelsModule,
    AuthModule,
    UserModule,
    CustomerModule,
    LoggerModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
