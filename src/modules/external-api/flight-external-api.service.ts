import { Injectable, Logger, Inject } from '@nestjs/common';
import { IFlightProvider } from '../providers/interfaces/flight-provider.interface';
import { Flight } from '../flights/types/flights.types';
import { FlightsSearchDto } from '../flights/dto/flights-search.dto';
import { ConfigService } from '@nestjs/config';
import { CacheServiceImpl } from '../../common/cache/cache.service';
import { buildCacheKey } from '../../common/cache/cache-key.util';

type ProviderResult = {
  provider: string
  results_count?: number,
  error_messages?: string
}

@Injectable()
export class FlightExternalApiService {
  private logger: Logger;
  private timeoutInMilliseconds: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject('FLIGHT_PROVIDERS') private readonly providers: IFlightProvider[],
    private readonly cacheService: CacheServiceImpl,
  ) {
    this.logger = new Logger(FlightExternalApiService.name);
    const timeout = this.configService.get<string>('SCATTER_GATHER_TIMEOUT');
    this.timeoutInMilliseconds = Number(timeout);
  }

  async handle(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: any[] }> {
    // trace_id/span_id are no longer computed here — CustomLogger already
    // injects them into every log call automatically (see getTraceContext()).
    // Computing it again here was redundant and got silently overwritten.
    const start = performance.now();
    const cacheKey = buildCacheKey('flights', query);

    const SearchEvent = {
      kind: "search",
      origin: query.origin,
      destination: query.destination,
      departure_date: query.departure_date,
      adults_count: query.adults_count,
      cache_key: cacheKey,
      cache_hit: false,
      providers_called: [] as string[],
      providers_result: [] as ProviderResult[],
      total_results: 0,
      duration_ms: 0,
      cache_write_status: '' as 'ok' | 'failed' | 'not_attempted',
      timestamp: new Date(),
    };

    const emit = () => {
      SearchEvent.duration_ms = performance.now() - start;
      this.logger.log(SearchEvent);
    };

    const cached = await this.cacheService.get<{
      data: Flight[];
      errors: any[];
    }>(cacheKey);
    if (cached) {
      SearchEvent.cache_hit = true;
      const sourceCounts = new Map<string, number>();
      cached.data.forEach(flight => {
        sourceCounts.set(flight.source, (sourceCounts.get(flight.source) || 0) + 1);
      });
      SearchEvent.providers_called = Array.from(sourceCounts.keys());
      SearchEvent.providers_result = Array.from(sourceCounts.entries()).map(
        ([provider, count]) => ({ provider, results_count: count }),
      );
      SearchEvent.total_results = cached.data.length;
      SearchEvent.cache_write_status = 'not_attempted';

      emit(); // duration_ms is now computed on this path too
      return cached;
    }

    SearchEvent.cache_hit = false
    const results = await Promise.allSettled(
      this.providers.map((provider) =>
        this.withTimeout(
          provider.searchFlights(query),
          this.timeoutInMilliseconds,
          provider.providerName,
        ),
      ),
    );

    const data: Flight[] = [];
    const errors: any[] = [];

    results.forEach((result, index) => {
      const providerName = this.providers[index].providerName;
      SearchEvent.providers_called.push(providerName)

      if (result.status === 'fulfilled') {
        data.push(...result.value);
        SearchEvent.providers_result.push({ provider: providerName, results_count: result.value.length })
      } else {
        const errorMsg = (result.reason as Error)?.message || 'Unknown Error';
        SearchEvent.providers_result.push({ provider: providerName, error_messages: errorMsg })
        errors.push({ provider: providerName, error: errorMsg });
      }
    });

    const response = { data, errors };
    SearchEvent.total_results = data.length

    if (data.length > 0) {
      try {
        await this.cacheService.set(cacheKey, response);
        SearchEvent.cache_write_status = "ok"
      } catch (error) {
        SearchEvent.cache_write_status = "failed"
      }
    } else {
      SearchEvent.cache_write_status = 'not_attempted';
    }

    emit();
    return response;
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    providerName: string,
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms for ${providerName}`)),
        ms,
      ),
    );
    return Promise.race([promise, timeout]);
  }
}