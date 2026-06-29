import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { HotelBooking } from '../entities/hotel-booking.entity';
import { HotelOutboxService } from '../hotel-outbox.service';
import { AuditAction } from '../../audit/audit-action.enum';
import { AuditPayload } from '../../audit/types/audit-payload.type';
import { generateUUID } from '../../../common/utils/uuid.util';
import type { ClsStore } from '../../../common/cls/cls-store.interface';

@Injectable()
@EventSubscriber()
export class HotelBookingSubscriber
  implements EntitySubscriberInterface<HotelBooking>
{
  private readonly logger = new Logger(HotelBookingSubscriber.name);

  constructor(
    dataSource: DataSource,
    private readonly clsService: ClsService<ClsStore>,
    private readonly outboxService: HotelOutboxService,
    private readonly configService: ConfigService,
  ) {
    // Register with TypeORM so it receives entity lifecycle events.
    // NestJS constructs this instance, giving us full DI — then we hand it
    // to TypeORM's subscriber registry manually.
    dataSource.subscribers.push(this);
  }

  /** Tell TypeORM which entity this subscriber listens to. */
  listenTo() {
    return HotelBooking;
  }

  // ── Insert ──────────────────────────────────────────────────────────────────

  async afterInsert(event: InsertEvent<HotelBooking>): Promise<void> {
    const entity = event.entity;
    if (!entity) return;

    const performedBy = this.clsService.get('userId') ?? 'SYSTEM';
    this.logger.log(`[afterInsert] HotelBooking ${entity.id} by ${performedBy}`);

    await this.writeAuditEvent(event.manager, {
      action:    AuditAction.HOTEL_BOOKING_CREATED,
      eventType: 'hotel_booking.created',
      entityId:  entity.id,
      performedBy,
      newValue:  this.toSnapshot(entity),
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async afterUpdate(event: UpdateEvent<HotelBooking>): Promise<void> {
    const newEntity = event.entity as HotelBooking | undefined;
    const oldEntity = event.databaseEntity as HotelBooking | undefined;
    if (!newEntity) return;

    const performedBy = this.clsService.get('userId') ?? 'SYSTEM';
    this.logger.log(`[afterUpdate] HotelBooking ${newEntity.id} by ${performedBy}`);

    await this.writeAuditEvent(event.manager, {
      action:    AuditAction.HOTEL_BOOKING_UPDATED,
      eventType: 'hotel_booking.updated',
      entityId:  newEntity.id,
      performedBy,
      oldValue:  oldEntity ? this.toSnapshot(oldEntity) : undefined,
      newValue:  this.toSnapshot(newEntity),
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Writes one audit outbox row using the active EntityManager, keeping it
   * inside the same transaction as the triggering save/update.
   */
  private async writeAuditEvent(
    em: Parameters<HotelOutboxService['writeEvent']>[0],
    opts: {
      action: AuditAction;
      eventType: string;
      entityId: string;
      performedBy: string;
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
    },
  ): Promise<void> {
    const payload: AuditPayload = {
      kind: 'audit',
      eventType: opts.eventType,
      entityType: 'HotelBooking',
      entityId: opts.entityId,
      action: opts.action,
      performedBy: opts.performedBy,
      oldValue: opts.oldValue as Record<string, unknown>,
      newValue: opts.newValue as Record<string, unknown>,
      correlationId: generateUUID(),
      timestamp: new Date().toISOString(),
    };

    await this.outboxService.writeEvent(em, payload);
  }

  /** Serialises a HotelBooking into a plain object safe for JSON storage. */
  private toSnapshot(entity: HotelBooking): Record<string, unknown> {
    return {
      id:            entity.id,
      transactionId: entity.transactionId,
      hotelId:       entity.hotelId,
      checkIn:       entity.checkIn,
      checkOut:      entity.checkOut,
      roomType:      entity.roomType,
      guestsCount:   entity.guestsCount,
      totalPrice:    entity.totalPrice,
      currency:      entity.currency,
      status:        entity.status,
    };
  }
}
