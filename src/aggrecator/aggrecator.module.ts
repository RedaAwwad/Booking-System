import { Module } from '@nestjs/common';

import { ProvidersModule } from 'src/providers/providers.module';
import { CacheServiceImpl } from './services/cache.service';
import { ProviderAggregationServiceImpl } from './services/provider-aggregation.service';
import { SearchService } from './services/search.service';

@Module({
    providers: [
        {
            provide: 'ICacheService',
            useClass: CacheServiceImpl,
        },
        {
            provide: 'IProviderAggregationService',
            useClass: ProviderAggregationServiceImpl,
        },
        SearchService,
    ],
    controllers: [],
    exports: [SearchService],
    imports: [ProvidersModule],
})
export class AggrecatorModule { }