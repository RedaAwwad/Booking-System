import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  IFlightProvider,
  FLIGHT_PROVIDERS,
  Flight,
  FlightsSearchDto,
} from '../flights/contracts';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from '../../common/cache/cache.interface';
import type { ICacheService } from '../../common/cache/cache.interface';
import { buildCacheKey } from '../../common/cache/cache-key.util';

/** Duffel offerRequests.create often needs 15–25s+ before offers are returned. */
const MIN_SCATTER_GATHER_TIMEOUT_MS = 45_000;

@Injectable()
export class FlightExternalApiService {
  private logger: Logger;
  private timeoutInMilliseconds: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(FLIGHT_PROVIDERS) private readonly providers: IFlightProvider[],
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {
    this.logger = new Logger(FlightExternalApiService.name);
    const raw = this.configService.get<string>('SCATTER_GATHER_TIMEOUT');
    const parsed = Number(raw);
    let timeout =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : MIN_SCATTER_GATHER_TIMEOUT_MS;

    if (timeout < MIN_SCATTER_GATHER_TIMEOUT_MS) {
      this.logger.warn(
        `SCATTER_GATHER_TIMEOUT=${timeout}ms is too low for Duffel; using ${MIN_SCATTER_GATHER_TIMEOUT_MS}ms`,
      );
      timeout = MIN_SCATTER_GATHER_TIMEOUT_MS;
    }

    this.timeoutInMilliseconds = timeout;
    this.logger.log(
      `Scatter-gather timeout: ${this.timeoutInMilliseconds}ms`,
    );
  }

  async handle(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: any[] }> {
    const cacheKey = buildCacheKey('flights', query);

    const cached = await this.cacheService.get<{
      data: Flight[];
      errors: any[];
    }>(cacheKey);
    if (cached) {
      this.logger.log(`Cache HIT — key: ${cacheKey}`);
      return cached;
    }

    this.logger.log(
      `Cache MISS — starting aggregation for ${this.providers.length} providers: ${this.providers.map((p) => p.providerName).join(', ')}`,
    );

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

      if (result.status === 'fulfilled') {
        data.push(...result.value);
        this.logger.log(
          `Successfully gathered ${result.value.length} results from ${providerName}`,
        );
      } else {
        const errorMsg = (result.reason as Error)?.message || 'Unknown Error';
        this.logger.error(`Provider ${providerName} failed: ${errorMsg}`);
        errors.push({ provider: providerName, error: errorMsg });
      }
    });

    const response = { data, errors };

    if (data.length > 0) {
      await this.cacheService.set(cacheKey, response);
      this.logger.log(`Cached ${data.length} results — key: ${cacheKey}`);
    }

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
