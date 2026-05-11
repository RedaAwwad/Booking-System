import { Module } from '@nestjs/common';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { AggregatorModule } from '../aggregator/aggregator.module';

@Module({
  imports: [AggregatorModule],
  controllers: [HotelsController],
  providers: [HotelsService],
})
export class HotelsModule {}
