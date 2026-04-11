import { Controller, Get, Query } from '@nestjs/common';
import { AggregatorService } from './aggrecator.service';
import { FlightSearchDto } from './DTO/flight-search.dto';

@Controller('aggrecator')

export class AggrecatorController {
  constructor(private readonly aggregator: AggregatorService) {}

  @Get('flights')
  async getFlights(@Query() query: FlightSearchDto) {
    const result = await this.aggregator.searchAllFlights(query);

    return {
      success: true,
      results: result.data,
      errors: result.errors,
    };
  }
}
