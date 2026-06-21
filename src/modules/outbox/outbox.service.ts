import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxMessage } from './entities/outbox-message.entity';
import { OutboxPayload } from './types/outbox-payload.type';

@Injectable()
export class OutboxService {
  writeEvent(
    em: EntityManager,
    input: {
      exchangeName: string;
      routingKey: string;
      payload: OutboxPayload;
    },
  ): Promise<OutboxMessage> {
    const message = em.create(OutboxMessage, input);
    return em.save(OutboxMessage, message);
  }
}

