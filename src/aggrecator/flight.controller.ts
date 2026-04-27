import { Body, Controller, Post, Inject, Get, Query } from '@nestjs/common';
import { FlightSearchDto } from './DTO/flight-search.dto';
import { SearchService } from './services/search.service';


@Controller('flights')
export class FlightController {
  constructor(
    private readonly flightAggregatorService: SearchService,
  ) {}

 @Get('search')
  async searchOfFlights(@Query() query: FlightSearchDto) {
    return await this.flightAggregatorService.searchOfFlights(query);
  }
}