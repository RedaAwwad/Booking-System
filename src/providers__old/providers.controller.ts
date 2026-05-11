import { Controller, Get, Query } from '@nestjs/common';
import { DuffelService } from './duffel.service';
import { FlightSearchDto } from '../aggrecator/DTO/flight-search.dto';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly duffelService: DuffelService) {}

  @Get('duffel/search')
  async searchDuffel(@Query() query: FlightSearchDto) {
    return this.duffelService.searchFlights(query);
  }
}
