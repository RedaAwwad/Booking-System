import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { generateUUID } from '../../common/utils/uuid.util';
import { HotelsSearchDto } from './dto/hotels-search.dto';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { Hotel } from './hotels.types';
import { TransactionsService } from '../transactions/transactions.service';
import { OutboxService } from '../outbox/outbox.service';
import { HotelBooking } from './entities/hotel-booking.entity';
import { AuditAction } from '../audit/audit-action.enum';
import {
  AuditPayload,
  NotificationPayload,
} from '../outbox/types/outbox-payload.type';

@Injectable()
export class HotelsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly outboxService: OutboxService,
  ) {}

  search(query: HotelsSearchDto): { data: Hotel[]; errors: [] } {
    console.log(query);
    // Logic for hotel aggregation will be implemented in HotelAggregatorService
    return { data: [], errors: [] };
  }

  async createBooking(dto: CreateHotelBookingDto): Promise<{
    message: string;
    transactionId: string;
    bookingId: string;
  }> {
    const notifExchange   = this.configService.getOrThrow<string>('NOTIFICATIONS_EXCHANGE');
    const notifRoutingKey = this.configService.getOrThrow<string>('NOTIFICATIONS_ROUTING_KEY');
    const auditExchange   = this.configService.getOrThrow<string>('AUDIT_EXCHANGE');
    const auditRoutingKey = this.configService.getOrThrow<string>('AUDIT_ROUTING_KEY');

    return this.dataSource.transaction(async (em) => {
      // 1. Create PENDING Transaction
      const transaction = await this.transactionsService.createWithEntityManager(em, {
        userId: dto.userId,
        amount: dto.totalPrice,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
      });

      // 2. Create Hotel Booking
      const hotelBooking = em.create(HotelBooking, {
        transactionId: transaction.id,
        hotelId: dto.hotelId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        roomType: dto.roomType,
        guestsCount: dto.guestsCount,
        totalPrice: dto.totalPrice,
        currency: dto.currency || 'USD',
      });
      await em.save(HotelBooking, hotelBooking);

      // 3. Write Notification Outbox Event
      await this.outboxService.writeEvent(em, {
        exchangeName: notifExchange,
        routingKey:   notifRoutingKey,
        payload: {
          kind: 'notification',
          transactionId: transaction.id,
          type: 'EMAIL',
          recipient: dto.userEmail,
          subject: `Hotel booking confirmation (Hotel ID: ${dto.hotelId})`,
          content: 'Your hotel booking is confirmed. Details...',
        } satisfies NotificationPayload,
      });

      // 4. Write Audit Outbox Event
      await this.outboxService.writeEvent(em, {
        exchangeName: auditExchange,
        routingKey:   auditRoutingKey,
        payload: {
          kind: 'audit',
          eventType:    'booking.created',
          entityType:   'HotelBooking',
          entityId:     hotelBooking.id,
          action:       AuditAction.HOTEL_BOOKING_CREATED,
          performedBy:  dto.userId,
          newValue: {
            hotelId:    dto.hotelId,
            checkIn:    dto.checkIn,
            checkOut:   dto.checkOut,
            totalPrice: dto.totalPrice,
            currency:   dto.currency,
          },
          correlationId: generateUUID(),
          timestamp:     new Date().toISOString(),
        } satisfies AuditPayload,
      });

      return {
        message: 'Hotel booking initiated',
        transactionId: transaction.id,
        bookingId: hotelBooking.id,
      };
    });
  }
}
