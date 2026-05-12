import { Module } from '@nestjs/common';
import { FlightExternalApiService } from './flight-external-api.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [FlightExternalApiService],
  exports: [FlightExternalApiService],
})
export class ExternalApiModule {}
