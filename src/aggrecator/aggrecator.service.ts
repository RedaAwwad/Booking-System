import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FlightSearchDto } from './DTO/flight-search.dto';
import { FlightAdapter } from './adapters/flight.adapter';
import { DuffelService } from '../providers/duffel.service';

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);
  private readonly REQUEST_TIMEOUT_MS = 5000; // Equivalent to timeoutInSeconds
  constructor(
    private readonly duffel: DuffelService,
  ) {}
  
  async searchAllFlights(query: FlightSearchDto) {
    const tasks = [
      { 
        name: 'Duffel', 
        call: this.duffel.searchFlightOffers(query) 
      },
    ];

    // 2. EXECUTE with Timeout
    const results = await Promise.allSettled(
      tasks.map(task => this.withTimeout(task.call, this.REQUEST_TIMEOUT_MS))
    );

    const finalData: any[] = [];
    const finalErrors: any[] = [];

    // 3. GATHER
    results.forEach((result, index) => {
      const providerName = tasks[index].name;

      if (result.status === 'fulfilled') {
        const normalized = result.value.map(item => {
          if (providerName === 'Duffel') return FlightAdapter.fromDuffel(item);
          return item;
        });
        finalData.push(...(normalized || []));
        this.logger.log(`Successfully gathered results from ${providerName}`);
      } else {
        // Handles both API errors and the Timeout error
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
   withTimeout(promise: Promise<any>, ms: number){
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
    return Promise.race([promise, timeout]);
  };
 
  
}