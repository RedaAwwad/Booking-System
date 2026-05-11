import { Module } from '@nestjs/common';
import { FlightAggregatorService } from './flight-aggregator.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [FlightAggregatorService],
  exports: [FlightAggregatorService],
})
export class AggregatorModule {}
