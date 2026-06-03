import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FlightsSearchDto } from './dto/flights-search.dto';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { Flight } from './flights.types';
import { TransactionsService } from '../transactions/transactions.service';
import { OutboxService } from '../outbox/outbox.service';
import { FlightSearchService } from '../external-api/flight-search.service';
import { FlightBooking } from './entities/flight-booking.entity';

@Injectable()
export class FlightsService {
  constructor(
    private readonly flightSearch: FlightSearchService,
    private readonly dataSource: DataSource,
    private readonly transactions: TransactionsService,
    private readonly outbox: OutboxService,
  ) {}

  async search(
    query: FlightsSearchDto,
  ): Promise<{ data: Flight[]; errors: string[] }> {
    return await this.flightSearch.search(query);
  }

  async createBooking(dto: CreateFlightBookingDto): Promise<any> {
    return this.dataSource.transaction(async (em) => {
      const transaction = await this.transactions.createInTransaction(em, {
        userId: dto.userId,
        amount: dto.totalPrice,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
      });

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

      await this.outbox.writeEvent(em, {
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
