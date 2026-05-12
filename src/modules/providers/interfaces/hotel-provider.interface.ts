import { Hotel } from '../../hotels/hotels.types';
import { HotelsSearchDto } from '../../hotels/dto/hotels-search.dto';

export interface IHotelProvider {
  readonly providerName: string;
  searchHotels(query: HotelsSearchDto): Promise<Hotel[]>;
  formatHotelResponse<T>(providerHotel: T): Hotel;
}
