import { Injectable } from '@nestjs/common';
import { FlightAggregatorService } from '../aggregator/flight-aggregator.service';
import { SearchFlightDto } from './dto/search-flight.dto';

@Injectable()
export class FlightsService {
  constructor(private readonly aggregator: FlightAggregatorService) {}

  async search(query: SearchFlightDto) {
    return this.aggregator.aggregate(query);
  }

  // Other methods (create, findOne) can be added here
}
