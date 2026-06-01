import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { FlightsSearchDto } from './dto/flights-search.dto';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';

@ApiTags('flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @ApiOperation({ summary: 'Search for flights across multiple providers' })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregated flight results and any provider errors.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed for search criteria.',
  })
  search(@Query() query: FlightsSearchDto) {
    return this.flightsService.search(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new flight booking' })
  @ApiResponse({
    status: 201,
    description: 'Returns the initiated booking transaction.',
  })
  createBooking(@Body() dto: CreateFlightBookingDto) {
    return this.flightsService.createBooking(dto);
  }
}
