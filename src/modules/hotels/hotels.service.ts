import { Injectable } from '@nestjs/common';
import { HotelsSearchDto } from './dto/hotels-search.dto';
import { Hotel } from './hotels.types';

@Injectable()
export class HotelsService {
  search(query: HotelsSearchDto): { data: Hotel[]; errors: [] } {
    console.log(query);
    // Logic for hotel aggregation will be implemented in HotelAggregatorService
    return { data: [], errors: [] };
  }
}
