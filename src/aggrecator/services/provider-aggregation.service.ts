import { Injectable, Logger, Inject } from '@nestjs/common';
import { IFlightProvider } from '../../providers/interfaces/flight-provider.interface';
import { FlightSearchDto } from '../DTO/flight-search.dto';
import { Flight } from '../interfaces/flight.interface';

export interface IProviderAggregationService {
  aggregate(query: FlightSearchDto): Promise<{ data: Flight[], errors: any[] }>;
}

@Injectable()
export class ProviderAggregationServiceImpl implements IProviderAggregationService {
  private readonly logger = new Logger(ProviderAggregationServiceImpl.name);
  private readonly TIMEOUT_MS = 5000;

  constructor(
    @Inject('FLIGHT_PROVIDERS') private readonly providers: IFlightProvider[],
  ) {}

  async aggregate(query: FlightSearchDto): Promise<{ data: Flight[], errors: any[] }> {
    this.logger.log(`Starting aggregation for ${this.providers.length} providers`);

    const tasks = this.providers.map(provider => ({
      name: provider.providerName,
      call: provider.searchFlights(query)
    }));

    const results = await Promise.allSettled(
      tasks.map(task => this.withTimeout(task.call, this.TIMEOUT_MS))
    );

    const data: Flight[] = [];
    const errors: any[] = [];

    results.forEach((result, index) => {
      const providerName = tasks[index].name;

      if (result.status === 'fulfilled') {
        data.push(...result.value);
        this.logger.log(`Successfully gathered results from ${providerName}`);
      } else {
        const err = result.reason;
        const errorMsg = err?.message || err?.errors?.[0]?.message || String(err) || 'Unknown Error';
        this.logger.error(`Provider ${providerName} failed: ${errorMsg}`);
        errors.push({ provider: providerName, error: errorMsg });
      }
    });

    return { data, errors };
  }

  private withTimeout(promise: Promise<any>, ms: number) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
    return Promise.race([promise, timeout]);
  }
}
