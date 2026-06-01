import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HotelsSearchDto } from './dto/hotels-search.dto';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { Hotel } from './hotels.types';
import { TransactionsService } from '../transactions/transactions.service';
import { OutboxService } from '../outbox/outbox.service';
import { HotelBooking } from './entities/hotel-booking.entity';

@Injectable()
export class HotelsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly outboxService: OutboxService,
  ) {}

  search(query: HotelsSearchDto): { data: Hotel[]; errors: [] } {
    console.log(query);
    // Logic for hotel aggregation will be implemented in HotelAggregatorService
    return { data: [], errors: [] };
  }

  async createBooking(dto: CreateHotelBookingDto): Promise<any> {
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

      // 3. Write Outbox Event
      await this.outboxService.writeEvent(em, {
        exchangeName: 'booking.notifications',
        routingKey: 'email.notifications',
        payload: {
          transactionId: transaction.id,
          type: 'EMAIL',
          recipient: dto.userEmail,
          subject: `Hotel booking confirmation (Hotel ID: ${dto.hotelId})`,
          content: 'Your hotel booking is confirmed. Details...',
        },
      });

      return {
        message: 'Hotel booking initiated',
        transactionId: transaction.id,
        bookingId: hotelBooking.id,
      };
    });
  }
}
