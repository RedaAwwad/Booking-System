import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { AggregatorModule } from '../aggregator/aggregator.module';

@Module({
  imports: [AggregatorModule],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}
