import { Module } from '@nestjs/common';

import { ProvidersModule } from 'src/providers/providers.module';
import { FlightAggregatorPublicServiceImpl } from './flight-aggregator.public-service';

@Module({
    providers: [
        {
            provide: 'FlightAggregatorPublicService',
            useClass: FlightAggregatorPublicServiceImpl,
        }
    ],
    controllers: [],
    exports: ['FlightAggregatorPublicService'],
    imports: [ProvidersModule],
})
export class AggrecatorModule { }