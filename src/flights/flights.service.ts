import { Injectable } from '@nestjs/common';
import { CreateFlightDto } from './dto/create-flight.dto';
import { SearchFlightDto } from './dto/search-flight.dto';

@Injectable()
export class FlightsService {
  findAll(query: SearchFlightDto) {
    return query;
  }

  create(createFlightDto: CreateFlightDto) {
    return createFlightDto;
  }

  findOne(id: number) {
    return `This action returns a #${id} flight`;
  }

}
