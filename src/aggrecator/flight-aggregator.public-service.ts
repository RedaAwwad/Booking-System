import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { FlightSearchDto } from './DTO/flight-search.dto';
import { IFlightProvider } from '../providers/interfaces/flight-provider.interface';
import { NormalizedFlight } from './interfaces/flight.interface';


export interface FlightAggregatorPublicService {
  searchAllFlights(query: FlightSearchDto): Promise<{
    data: NormalizedFlight[];
    errors: any[];
    meta: { count: number; timestamp: string };
  }>;
}

@Injectable()
export class FlightAggregatorPublicServiceImpl implements FlightAggregatorPublicService {
  private readonly logger = new Logger(FlightAggregatorPublicServiceImpl.name);
  private readonly TIMEOUT_MS = 5000;

  constructor(
    @Inject('FLIGHT_PROVIDERS') 
    private readonly providers: IFlightProvider[],
  ) {}

  async searchAllFlights(query: FlightSearchDto) {
    this.logger.log(`Starting aggregation for ${this.providers.length} providers`);

    //Scatter
    const tasks = this.providers.map(provider => ({
      name: provider.providerName,
      call: provider.searchFlights(query)
    }));

    const results = await Promise.allSettled(
      tasks.map(task => this.withTimeout(task.call, this.TIMEOUT_MS))
    );

    const finalData: NormalizedFlight[] = [];
    const finalErrors: any[] = [];

    // Gather
    results.forEach((result, index) => {
      const providerName = tasks[index].name;

      if (result.status === 'fulfilled') {
        finalData.push(...result.value);
        this.logger.log(`Successfully gathered results from ${providerName}`);
      } else {
        const errorMsg = result.reason?.message || 'Unknown Error';
        this.logger.error(`Provider ${providerName} failed: ${errorMsg}`);
        finalErrors.push({ provider: providerName, error: errorMsg });
      }
    });

    return {
      data: finalData,
      errors: finalErrors,
      meta: {
        count: finalData.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  private withTimeout(promise: Promise<any>, ms: number) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
    return Promise.race([promise, timeout]);
  }
}