import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { FlightSearchDto } from '../DTO/flight-search.dto';
import type { ICacheService } from './cache.service';
import type { IProviderAggregationService } from './provider-aggregation.service';
import { Flight } from '../interfaces/flight.interface';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject('IProviderAggregationService') private readonly aggregationService: IProviderAggregationService,
  ) {}

  async searchOfFlights(query: FlightSearchDto) {
    const hash = createHash('sha256').update(JSON.stringify(query)).digest('hex');
    const cacheKey = `flights:${hash}`;
    
    const cachedResult = await this.cacheService.get<{
      data: Flight[];
      errors: any[];
      meta: { count: number; timestamp: string };
    }>(cacheKey);

    if (cachedResult) {
      this.logger.log('Returning flight results from cache');
      return cachedResult;
    }

    const { data, errors } = await this.aggregationService.aggregate(query);

    const result = {
      data,
      errors,
      meta: {
        count: data.length,
        timestamp: new Date().toISOString()
      }
    };

    if (errors.length === 0) {
      this.logger.log('Caching complete results...');
      await this.cacheService.set(cacheKey, result, 300000);
    } else {
      this.logger.warn(`Skipping cache because ${errors.length} provider(s) failed`);
    }

    return result;
  }
}
