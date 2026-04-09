import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AmadeusModule } from './amadeus/amadeus.module';
import { SkyscannerModule } from './skyscanner/skyscanner.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AmadeusModule,
    SkyscannerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
