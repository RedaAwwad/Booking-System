import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { FlightBooking } from '../entities/flight-booking.entity';
import { FlightOutboxService } from '../flight-outbox.service';
import { AuditAction } from '../../audit/audit-action.enum';
import { AuditPayload } from '../../audit/types/audit-payload.type';
import { generateUUID } from '../../../common/utils/uuid.util';
import type { ClsStore } from '../../../common/cls/cls-store.interface';

@Injectable()
@EventSubscriber()
export class FlightBookingSubscriber
  implements EntitySubscriberInterface<FlightBooking>
{
  private readonly logger = new Logger(FlightBookingSubscriber.name);

  constructor(
    dataSource: DataSource,
    private readonly clsService: ClsService<ClsStore>,
    private readonly outboxService: FlightOutboxService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return FlightBooking;
  }

  async afterInsert(event: InsertEvent<FlightBooking>): Promise<void> {
    const entity = event.entity;
    if (!entity) return;

    const performedBy = this.clsService.get('userId') ?? 'SYSTEM';
    this.logger.log(`[afterInsert] FlightBooking ${entity.id} by ${performedBy}`);

    await this.writeAuditEvent(event.manager, {
      action:    AuditAction.FLIGHT_BOOKING_CREATED,
      eventType: 'flight_booking.created',
      entityId:  entity.id,
      performedBy,
      newValue:  this.toSnapshot(entity),
    });
  }

  async afterUpdate(event: UpdateEvent<FlightBooking>): Promise<void> {
    const newEntity = event.entity as FlightBooking | undefined;
    const oldEntity = event.databaseEntity as FlightBooking | undefined;
    if (!newEntity) return;

    const performedBy = this.clsService.get('userId') ?? 'SYSTEM';
    this.logger.log(`[afterUpdate] FlightBooking ${newEntity.id} by ${performedBy}`);

    await this.writeAuditEvent(event.manager, {
      action:    AuditAction.FLIGHT_BOOKING_UPDATED,
      eventType: 'flight_booking.updated',
      entityId:  newEntity.id,
      performedBy,
      oldValue:  oldEntity ? this.toSnapshot(oldEntity) : undefined,
      newValue:  this.toSnapshot(newEntity),
    });
  }

  private async writeAuditEvent(
    em: Parameters<FlightOutboxService['writeEvent']>[0],
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
      entityType: 'FlightBooking',
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

  private toSnapshot(entity: FlightBooking): Record<string, unknown> {
    return {
      id:            entity.id,
      transactionId: entity.transactionId,
      origin:        entity.origin,
      destination:   entity.destination,
      departureDate: entity.departureDate,
      cabinClass:    entity.cabinClass,
      adultsCount:   entity.adultsCount,
      totalPrice:    entity.totalPrice,
      currency:      entity.currency,
      status:        entity.status,
    };
  }
}
