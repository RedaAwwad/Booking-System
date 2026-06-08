import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HotelsSearchDto } from './dto/hotels-search.dto';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { Hotel } from './hotels.types';
import { TransactionsService } from '../transactions/transactions.service';
import { OutboxService } from '../outbox/outbox.service';
import { createBookingEmail } from '../notifications/email/templates/booking.template';
import { HotelBooking } from './entities/hotel-booking.entity';

@Injectable()
export class HotelsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: TransactionsService,
    private readonly outbox: OutboxService,
  ) {}

  search(query: HotelsSearchDto): { data: Hotel[]; errors: [] } {
    console.log(query);
    return { data: [], errors: [] };
  }

  async createBooking(dto: CreateHotelBookingDto): Promise<any> {
    return this.dataSource.transaction(async (em) => {
      const transaction = await this.transactions.createInTransaction(em, {
        userId: dto.userId,
        amount: dto.totalPrice,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
      });

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

      const bookingEmail = createBookingEmail({
        bookingType: 'hotel',
        bookingId: hotelBooking.id,
        userName: dto.userEmail.split('@')[0],
        totalPrice: dto.totalPrice,
        currency: dto.currency || 'USD',
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
      });

      await this.outbox.writeEvent(em, {
        exchangeName: 'booking.notifications',
        routingKey: 'email.notifications',
        payload: {
          transactionId: transaction.id,
          type: 'EMAIL',
          recipient: dto.userEmail,
          subject: bookingEmail.subject,
          text: bookingEmail.text,
          html: bookingEmail.html,
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
