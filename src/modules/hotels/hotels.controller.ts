import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HotelsSearchDto } from './dto/hotels-search.dto';
import { HotelsService } from './hotels.service';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOperation({ summary: 'Search for hotels across multiple providers' })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregated hotel results and any provider errors.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed for search criteria.',
  })
  search(@Query() query: HotelsSearchDto) {
    return this.hotelsService.search(query);
  }
}
