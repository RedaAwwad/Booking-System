import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  IOutboxService,
  OutboxEventInput,
  OutboxEventRef,
} from './contracts/outbox.interface';
import { OutboxMessage } from './entities/outbox-message.entity';

@Injectable()
export class OutboxService implements IOutboxService {
  async writeEvent(
    em: EntityManager,
    input: OutboxEventInput,
  ): Promise<OutboxEventRef> {
    const message = em.create(OutboxMessage, input);
    const saved = await em.save(OutboxMessage, message);
    return { id: saved.id };
  }
}
