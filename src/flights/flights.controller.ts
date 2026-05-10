import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { SearchFlightDto } from './dto/search-flight.dto';

@ApiTags('Flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @ApiOperation({ summary: 'Search for flights' })
  @ApiResponse({
    status: 200,
    description: 'Return a list of flights matching the search criteria.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed for search criteria.',
  })
  findAll(@Query() query: SearchFlightDto) {
    return this.flightsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new flight (Not implemented)' })
  @ApiResponse({
    status: 201,
    description: 'The flight has been successfully created.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed for flight data.',
  })
  create(@Body() createFlightDto: CreateFlightDto) {
    return this.flightsService.create(createFlightDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific flight' })
  @ApiParam({ name: 'id', description: 'Unique identifier of the flight' })
  @ApiResponse({
    status: 200,
    description: 'Return details of the requested flight.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid ID format.' })
  @ApiResponse({ status: 404, description: 'Flight not found.' })
  findOne(@Param('id') id: string) {
    return this.flightsService.findOne(+id);
  }
}
