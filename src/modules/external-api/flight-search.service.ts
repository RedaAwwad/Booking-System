import { Injectable } from '@nestjs/common';
import { FlightsSearchDto } from '../flights/contracts';
import {
  FlightSearchResult,
  IFlightSearchService,
} from './contracts/flight-search.interface';
import { FlightExternalApiService } from './flight-external-api.service';

@Injectable()
export class FlightSearchService implements IFlightSearchService {
  constructor(
    private readonly flightExternalApiService: FlightExternalApiService,
  ) {}

  async search(query: FlightsSearchDto): Promise<FlightSearchResult> {
    const result = await this.flightExternalApiService.handle(query);
    return {
      data: result.data,
      errors: result.errors.map((e) =>
        typeof e === 'string' ? e : JSON.stringify(e),
      ),
    };
  }
}
