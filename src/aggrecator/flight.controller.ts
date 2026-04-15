
import { Body, Controller, Post, Inject, Get, Query } from '@nestjs/common';
import { FlightSearchDto } from './DTO/flight-search.dto';
import type { FlightAggregatorPublicService } from './flight-aggregator.public-service';


@Controller('flights')
export class FlightController {
  constructor(
    @Inject('FlightAggregatorPublicService')
    private readonly flightAggregatorService: FlightAggregatorPublicService,
  ) {}

 @Get('search')
  async searchAllFlights(@Query() query: FlightSearchDto) {
    return await this.flightAggregatorService.searchAllFlights(query);
  }
}