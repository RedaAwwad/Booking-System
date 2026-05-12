export interface Hotel {
  id: string;
  source: string;
  name: string;
  address?: string;
  city?: string;
  rating?: number;
  price: number;
  currency: string;
  amenities?: string[];
}
