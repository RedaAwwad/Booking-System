import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { FlightsSearchDto } from './dto/flights-search.dto';

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
}
