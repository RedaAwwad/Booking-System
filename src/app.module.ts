import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AggrecatorModule } from './aggrecator/aggrecator.module';
import { ProvidersModule } from './providers/providers.module';
import { FlightController } from './aggrecator/flight.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AggrecatorModule,
    ProvidersModule,
  ],
  controllers: [AppController,FlightController],
  providers: [AppService],
})
export class AppModule { }
