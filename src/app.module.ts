import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightsModule } from './flights/flights.module';

// import { AggrecatorModule } from './aggrecator/aggrecator.module';
// import { ProvidersModule } from './providers/providers.module';
// import { FlightController } from './aggrecator/flight.controller';
// import { CacheModule } from '@nestjs/cache-manager';
// import { redisStore } from 'cache-manager-redis-yet';
// import { FlightsController } from './flights/flights.controller';
import { ProvidersModule } from './providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // CacheModule.registerAsync({
    //   isGlobal: true,
    //   useFactory: async () => ({
    //     store: await redisStore({
    //       socket: {
    //         host: 'localhost',
    //         port: 6379,
    //       },
    //     }),
    //   }),
    // }),
    // AggrecatorModule,
    // ProvidersModule,
    FlightsModule,
    ProvidersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
