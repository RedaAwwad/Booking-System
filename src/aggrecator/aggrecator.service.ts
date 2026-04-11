import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FlightSearchDto } from './DTO/flight-search.dto';
import { FlightAdapter } from './adapters/flight.adapter';
import { AmadeusService } from 'src/providers/amadeus.service';
import { SkyscannerService } from 'src/providers/skyscanner.service';

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);
  private readonly REQUEST_TIMEOUT_MS = 5000; // Equivalent to timeoutInSeconds
private readonly USE_FAKE_DATA = true;
  constructor(
    private readonly amadeus: AmadeusService,
    private readonly skyscanner: SkyscannerService,
  ) {}
  
  async searchAllFlights(query: FlightSearchDto) {
    const skyscannerParams = FlightAdapter.toSkyscannerParams(query);
    // 1. SCATTER: Define the tasks
    // We wrap them in a helper so we can track the name during processing
    const tasks = [
      { 
        name: 'Amadeus', 
        call: this.amadeus.searchFlightOffers(query) 
      },
      { 
        name: 'Skyscanner', 
        call: this.skyscanner.searchFlights(skyscannerParams) 
      },
    ];

    // 2. EXECUTE with Timeout (The "get(timeout, units)" part of your Java code)
    const results = await Promise.allSettled(
      tasks.map(task => this.withTimeout(task.call, this.REQUEST_TIMEOUT_MS))
    );

    const finalData: any[] = [];
    const finalErrors: any[] = [];

    // 3. GATHER (The stream filter/map part of your Java code)
    results.forEach((result, index) => {
      const providerName = tasks[index].name;

      if (result.status === 'fulfilled') {
        // APPLY ADAPTER HERE
        const normalized = result.value.map(item => {
          if (providerName === 'Amadeus') return FlightAdapter.fromAmadeus(item);
          if (providerName === 'Skyscanner') return FlightAdapter.fromSkyscanner(item);
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