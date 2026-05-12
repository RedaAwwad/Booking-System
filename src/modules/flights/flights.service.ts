import { Injectable } from '@nestjs/common';
import { FlightExternalApiService } from '../external-api/flight-external-api.service';
import { FlightsSearchDto } from './dto/flights-search.dto';
import { Flight } from './flights.types';

@Injectable()
export class FlightsService {
  constructor(private readonly externalApiService: FlightExternalApiService) {}

  async search(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: string[] }> {
    return await this.externalApiService.handle(query);
  }

  // Other methods (create, findOne) can be added here
}
