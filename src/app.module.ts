import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AggrecatorController } from './aggrecator/aggrecator.controller';
import { AggregatorService } from './aggrecator/aggrecator.service';
import { AggrecatorModule } from './aggrecator/aggrecator.module';
import { ProvidersModule } from './providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AggrecatorModule,
    ProvidersModule,
  ],
  controllers: [AppController, AggrecatorController],
  providers: [AppService, AggregatorService],
})
export class AppModule {}
