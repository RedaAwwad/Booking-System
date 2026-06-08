import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { CacheServiceImpl } from './cache.service';
import { CACHE_SERVICE } from './cache.interface';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          new KeyvRedis(
            config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          ),
        ],
        ttl: Number(config.get<string>('CACHE_TTL') ?? 300000),
      }),
    }),
  ],
  providers: [
    CacheServiceImpl,
    { provide: CACHE_SERVICE, useClass: CacheServiceImpl },
  ],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
