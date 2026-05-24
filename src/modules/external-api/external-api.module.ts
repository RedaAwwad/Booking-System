import { Module } from '@nestjs/common';
import { FlightExternalApiService } from './flight-external-api.service';
import { ProvidersModule } from '../providers/providers.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [ProvidersModule, CacheModule],
  providers: [FlightExternalApiService],
  exports: [FlightExternalApiService],
})
export class ExternalApiModule {}
