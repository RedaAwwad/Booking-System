import type { Offer } from '@duffel/api/types';

export interface DuffelOfferRequestError {
  errors: Array<{ message: string }>;
}

export type DuffelFlightOffer = Pick<Offer, 'id' | 'total_amount' | 'total_currency' | 'owner' | 'slices'>;
