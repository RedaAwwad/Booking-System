import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { generateUUID } from '../../common/utils/uuid.util';
import { FlightExternalApiService } from '../external-api/flight-external-api.service';
import { FlightsSearchDto } from './dto/flights-search.dto';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { Flight } from './types/flights.types';
import { TransactionsService } from '../transactions/transactions.service';
import { FlightOutboxService } from './flight-outbox.service';
import { FlightBooking } from './entities/flight-booking.entity';
import { NotificationPayload } from '../notifications/types/notification-payload.type';

@Injectable()
export class FlightsService {
  private readonly logger: Logger;

  constructor(
    private readonly configService: ConfigService,
    private readonly externalApiService: FlightExternalApiService,
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly outboxService: FlightOutboxService,
  ) {
    this.logger = new Logger(FlightsService.name);
  }

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
    const start = performance.now();
    const bookingEvent = {
      kind: 'booking',
      user_id: dto.userId,
      origin: dto.origin,
      destination: dto.destination,
      provider: dto.provider ?? 'unknown',
      total_price: dto.totalPrice,
      payment_method: dto.paymentMethod,
      transaction_id: '',
      booking_id: '',
      status: 'pending' as 'pending' | 'confirmed' | 'failed',
      duration_ms: 0,
      error_message: undefined as string | undefined,
      error_stack: undefined as string | undefined,
      timestamp: new Date(),
    };

    const emit = () => {
      bookingEvent.duration_ms = performance.now() - start;
      if (bookingEvent.status === 'failed') {
        this.logger.error(bookingEvent);
      } else {
        this.logger.log(bookingEvent);
      }
    };

    try {
      const result = await this.dataSource.transaction(async (em) => {
        const transaction = await this.transactionsService.createWithEntityManager(em, {
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
        await this.outboxService.writeEvent(em, {
          kind: 'notification',
          transactionId: transaction.id,
          type: 'EMAIL',
          recipient: dto.userEmail,
          subject: `Flight booking confirmation (${dto.origin} → ${dto.destination})`,
          content: 'Your flight booking is confirmed. Details...',
        } satisfies NotificationPayload);
        return {
          message: 'Flight booking initiated',
          transactionId: transaction.id,
          bookingId: flightBooking.id,
        };
      });
      bookingEvent.status = 'confirmed';
      bookingEvent.transaction_id = result.transactionId;
      bookingEvent.booking_id = result.bookingId;
      emit();
      return result;
    } catch (error) {
      bookingEvent.status = 'failed';
      bookingEvent.error_message = (error as Error).message;
      bookingEvent.error_stack = (error as Error).stack;
      emit();
      throw error;
    }
  }
}