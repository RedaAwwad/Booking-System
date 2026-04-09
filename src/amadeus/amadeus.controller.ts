import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AmadeusService } from './amadeus.service';

@ApiTags('Amadeus')
@Controller('amadeus')
export class AmadeusController {
  
  constructor(private readonly amadeusService: AmadeusService) {}

  @Get('flight-offers')
  @ApiOperation({ summary: 'Search for flight offers using Amadeus API' })
  @ApiQuery({ name: 'originLocationCode', required: true, example: 'SYD' })
  @ApiQuery({ name: 'destinationLocationCode', required: true, example: 'BKK' })
  @ApiQuery({ name: 'departureDate', required: true, example: '2026-04-23' })
  @ApiQuery({ name: 'returnDate', required: true, example: '2026-05-07' })
  @ApiQuery({ name: 'adults', required: true, example: 1 })
  @ApiResponse({ status: 200, description: 'Flight offers retrieved successfully.' })
  searchFlightOffers(
    @Query('originLocationCode') originLocationCode: string,
    @Query('destinationLocationCode') destinationLocationCode: string,
    @Query('departureDate') departureDate: string,
    @Query('returnDate') returnDate: string,
    @Query('adults') adults: number,
    @Query('max') max: number,
        
  ) {
    // Basic mock implementation. Service will go here.
   return this.amadeusService.searchFlightOffers({
    originLocationCode,
    destinationLocationCode,
    departureDate,
    returnDate,
    adults,
    max,
   });
  }
}
