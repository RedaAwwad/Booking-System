export interface ICacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

export const CACHE_SERVICE = 'CACHE_SERVICE';
