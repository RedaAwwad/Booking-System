import { EntityManager } from 'typeorm';

export interface OutboxEventInput {
  exchangeName: string;
  routingKey: string;
  payload: Record<string, unknown>;
}

export interface OutboxEventRef {
  id: string;
}

export interface IOutboxService {
  writeEvent(
    em: EntityManager,
    input: OutboxEventInput,
  ): Promise<OutboxEventRef>;
}
