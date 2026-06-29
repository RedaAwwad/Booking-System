import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { HotelOutboxMessage } from './entities/hotel-outbox-message.entity';
import { HotelOutboxEvent } from './types/hotel-outbox-event.type';

@Injectable()
export class HotelOutboxService {
  writeEvent(
    em: EntityManager,
    payload: HotelOutboxEvent,
  ): Promise<HotelOutboxMessage> {
    const message = em.create(HotelOutboxMessage, { payload });
    return em.save(HotelOutboxMessage, message);
  }
}
