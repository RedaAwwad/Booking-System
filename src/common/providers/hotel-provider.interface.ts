import { Hotel } from '../interfaces/hotel.interface';
import { SearchHotelDto } from '../../modules/hotels/dto/search-hotel.dto';

export interface IHotelProvider {
  readonly providerName: string;
  searchHotels(query: SearchHotelDto): Promise<Hotel[]>;
}
