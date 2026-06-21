import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { generateUUID } from '../../common/utils/uuid.util';
import { FlightExternalApiService } from '../external-api/flight-external-api.service';
import { FlightsSearchDto } from './dto/flights-search.dto';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { Flight } from './flights.types';
import { TransactionsService } from '../transactions/transactions.service';
import { OutboxService } from '../outbox/outbox.service';
import { FlightBooking } from './entities/flight-booking.entity';
import { AuditAction } from '../audit/audit-action.enum';
import {
  AuditPayload,
  NotificationPayload,
} from '../outbox/types/outbox-payload.type';

@Injectable()
export class FlightsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly externalApiService: FlightExternalApiService,
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly outboxService: OutboxService,
  ) {}

  async search(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: string[] }> {
    return await this.externalApiService.handle(query);
  }

  async createBooking(dto: CreateFlightBookingDto): Promise<{
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
      const transaction =
        await this.transactionsService.createWithEntityManager(em, {
          userId: dto.userId,
          amount: dto.totalPrice,
          currency: dto.currency,
          paymentMethod: dto.paymentMethod,
        });

      // 2. Create Flight Booking
      const flightBooking = em.create(FlightBooking, {
        transactionId: transaction.id,
        origin: dto.origin,
        destination: dto.destination,
        departureDate: dto.departureDate,
        cabinClass: dto.cabinClass,
        adultsCount: dto.adultsCount,
        totalPrice: dto.totalPrice,
        currency: dto.currency || 'USD',
      });
      await em.save(FlightBooking, flightBooking);

      // 3. Write Notification Outbox Event
      await this.outboxService.writeEvent(em, {
        exchangeName: notifExchange,
        routingKey:   notifRoutingKey,
        payload: {
          kind: 'notification',
          transactionId: transaction.id,
          type: 'EMAIL',
          recipient: dto.userEmail,
          subject: `Flight booking confirmation (${dto.origin} → ${dto.destination})`,
          content: 'Your flight booking is confirmed. Details...',
        } satisfies NotificationPayload,
      });

      // 4. Write Audit Outbox Event
      await this.outboxService.writeEvent(em, {
        exchangeName: auditExchange,
        routingKey:   auditRoutingKey,
        payload: {
          kind: 'audit',
          eventType:    'booking.created',
          entityType:   'FlightBooking',
          entityId:     flightBooking.id,
          action:       AuditAction.FLIGHT_BOOKING_CREATED,
          performedBy:  dto.userId,
          newValue: {
            origin:      dto.origin,
            destination: dto.destination,
            totalPrice:  dto.totalPrice,
            currency:    dto.currency,
          },
          correlationId: generateUUID(),
          timestamp:     new Date().toISOString(),
        } satisfies AuditPayload,
      });

      return {
        message: 'Flight booking initiated',
        transactionId: transaction.id,
        bookingId: flightBooking.id,
      };
    });
  }
}
