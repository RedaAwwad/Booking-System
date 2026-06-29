import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FlightOutboxMessage } from './entities/flight-outbox-message.entity';
import { FlightOutboxEvent } from './types/flight-outbox-event.type';

@Injectable()
export class FlightOutboxService {
  writeEvent(
    em: EntityManager,
    payload: FlightOutboxEvent,
  ): Promise<FlightOutboxMessage> {
    const message = em.create(FlightOutboxMessage, { payload });
    return em.save(FlightOutboxMessage, message);
  }
}
