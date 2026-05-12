import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightsModule } from './modules/flights/flights.module';
import { HotelsModule } from './modules/hotels/hotels.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FlightsModule,
    HotelsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
