import { Injectable } from '@nestjs/common';
import { SearchHotelDto } from './dto/search-hotel.dto';

@Injectable()
export class HotelsService {
  async search(query: SearchHotelDto) {
    // Logic for hotel aggregation will be implemented in HotelAggregatorService
    return { data: [], errors: [] };
  }
}

