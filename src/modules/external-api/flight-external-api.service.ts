import { trace } from '@opentelemetry/api';
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
    const activeSpan = trace.getActiveSpan();
    const spanContext = activeSpan?.spanContext();
    let SearchEvent = {
      trace_id: spanContext?.traceId ?? null,
      span_id: spanContext?.spanId ?? null,
      kind: "search",
      origin: query.origin,
      destination: query.destination,
      departure_date: query.departure_date,
      adults_count: query.adults_count,
      cache_key: "",
      cache_hit: false,
      providers_called: [""],
      providers_result: [] as ProviderResult[],
      total_results: 0,
      duration_ms: 0,
      cache_write_status: "",
      timestamp: new Date(),
    };

    const start = performance.now();
    const cacheKey = buildCacheKey('flights', query);
    SearchEvent.cache_key = cacheKey;

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
      SearchEvent.providers_called = Object.keys(sourceCounts);


      SearchEvent.providers_result = Object.entries(sourceCounts).map(([source, count]) => ({
        provider: source,
        results_count: count
      }));

      this.logger.log(SearchEvent)
      //this.logger.log(`Cache HIT — key: ${cacheKey}`);
      return cached;
    }


    /*this.logger.log(
      `Cache MISS — starting aggregation for ${this.providers.length} providers: ${this.providers.map((p) => p.providerName).join(', ')}`,
    );*/

    SearchEvent.cache_hit = false
    //SearchEvent.providers_called = this.providers.map((p) => p.providerName)
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
        /*this.logger.log(
          `Successfully gathered ${result.value.length} results from ${providerName}`,
        );*/
        SearchEvent.providers_result.push({ provider: providerName, results_count: result.value.length })
      } else {
        const errorMsg = (result.reason as Error)?.message || 'Unknown Error';
        //this.logger.error(`Provider ${providerName} failed: ${errorMsg}`);
        SearchEvent.providers_result.push({ provider: providerName, error_messages: errorMsg })
        errors.push({ provider: providerName, error: errorMsg });
      }
    });

    const response = { data, errors };

    if (data.length > 0) {
      SearchEvent.total_results = data.length
      try {
        await this.cacheService.set(cacheKey, response);
        SearchEvent.cache_write_status = "ok"
        //this.logger.log(`Cached ${data.length} results — key: ${cacheKey}`);
      } catch (error) {
        SearchEvent.cache_write_status = "failed"
      }
    }
    const end = performance.now();
    SearchEvent.duration_ms = end - start

    this.logger.log(SearchEvent)
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
