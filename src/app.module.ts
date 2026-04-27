import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AggrecatorModule } from './aggrecator/aggrecator.module';
import { ProvidersModule } from './providers/providers.module';
import { FlightController } from './aggrecator/flight.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: 'localhost',
            port: 6379,
          },
        }),
      }),
    }),
    AggrecatorModule,
    ProvidersModule,
  ],
  controllers: [AppController,FlightController],
  providers: [AppService],
})
export class AppModule { }
