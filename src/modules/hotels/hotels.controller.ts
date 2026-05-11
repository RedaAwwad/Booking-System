import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { SearchHotelDto } from './dto/search-hotel.dto';

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
  search(@Query() query: SearchHotelDto) {
    return this.hotelsService.search(query);
  }
}

