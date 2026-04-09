import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SkyscannerService } from './skyscanner.service';

@ApiTags('Skyscanner')
@Controller('skyscanner')
export class SkyscannerController {
  
  constructor(private readonly skyscannerService: SkyscannerService) {}

  @Get('flight-search')
  @ApiOperation({ summary: 'Search for flights using Skyscanner API' })
  @ApiQuery({ name: 'fromId', required: true, example: 'LOND' })
  @ApiQuery({ name: 'toId', required: true, example: 'NYCA' })
  @ApiQuery({ name: 'departDate', required: true, example: '2026-11-01' })
  @ApiResponse({ status: 200, description: 'Flights retrieved successfully.' })
  searchFlights(
    @Query('fromId') fromId: string,
    @Query('toId') toId: string,
    @Query('departDate') departDate: string,
  ) {
    console.log(fromId, toId, departDate);
    return this.skyscannerService.searchFlights({ fromId, toId, departDate });
  }
}
