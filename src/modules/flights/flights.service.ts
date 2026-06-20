import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FlightExternalApiService } from '../external-api/flight-external-api.service';
import { FlightsSearchDto } from './dto/flights-search.dto';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { Flight } from './flights.types';
import { TransactionsService } from '../transactions/transactions.service';
import { OutboxService } from '../outbox/outbox.service';
import { FlightBooking } from './entities/flight-booking.entity';
import { AUDIT_SERVICE } from '../audit/audit.interface';
import type { IAuditService } from '../audit/audit.interface';
import { AuditAction } from '../audit/audit-action.enum';


@Injectable()
export class FlightsService {
  constructor(
    private readonly externalApiService: FlightExternalApiService,
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly outboxService: OutboxService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async search(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: string[] }> {
    return await this.externalApiService.handle(query);
  }

  async createBooking(dto: CreateFlightBookingDto): Promise<any> {
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

      // 3. Write Audit Log
      await this.auditService.writeLog(em, {
        userId: dto.userId,
        action: AuditAction.FLIGHT_BOOKING_CREATED,
        entityName: 'FlightBooking',
        entityId: flightBooking.id,
      });

      // 4. Write Outbox Event
      await this.outboxService.writeEvent(em, {
        exchangeName: 'booking.notifications',
        routingKey: 'email.notifications',
        payload: {
          transactionId: transaction.id,
          type: 'EMAIL',
          recipient: dto.userEmail,
          subject: `Flight booking confirmation (${dto.origin} → ${dto.destination})`,
          content: 'Your flight booking is confirmed. Details...',
        },
      });

      return {
        message: 'Flight booking initiated',
        transactionId: transaction.id,
        bookingId: flightBooking.id,
      };
    });
  }
}
