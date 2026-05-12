import { Injectable, Logger, Inject } from '@nestjs/common';
import { IFlightProvider } from '../providers/interfaces/flight-provider.interface';
import { Flight } from '../flights/flights.types';
import { FlightsSearchDto } from '../flights/dto/flights-search.dto';

@Injectable()
export class FlightExternalApiService {
  private readonly logger = new Logger(FlightExternalApiService.name);
  private readonly TIMEOUT_MS = 10000;

  constructor(
    @Inject('FLIGHT_PROVIDERS') private readonly providers: IFlightProvider[],
  ) {}

  async handle(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: any[] }> {
    this.logger.log(
      `Starting aggregation for ${this.providers.length} providers: ${this.providers.map((p) => p.providerName).join(', ')}`,
    );

    const results = await Promise.allSettled(
      this.providers.map((provider) =>
        this.withTimeout(
          provider.searchFlights(query),
          this.TIMEOUT_MS,
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

    return { data, errors };
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
