import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { HotelsSearchDto } from './dto/hotels-search.dto';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { Hotel } from './hotels.types';
import { TransactionsService } from '../transactions/transactions.service';
import { HotelOutboxService } from './hotel-outbox.service';

import { HotelBooking } from './entities/hotel-booking.entity';
import { NotificationPayload } from '../notifications/types/notification-payload.type';
import type { ClsStore } from '../../common/cls/cls-store.interface';

@Injectable()
export class HotelsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly clsService: ClsService<ClsStore>,
    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
    private readonly outboxService: HotelOutboxService,
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


    return this.dataSource.transaction(async (em) => {
      // 1. Create PENDING Transaction
      const transaction = await this.transactionsService.createWithEntityManager(em, {
        userId: dto.userId,
        amount: dto.totalPrice,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
      });

      // 2. Create Hotel Booking
      //    HotelBookingSubscriber.afterInsert() fires here automatically and
      //    writes the audit outbox row — no manual audit call needed.
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
      //    Notifications are still explicit because they carry context (email, subject)
      //    that is not stored on the entity and cannot be inferred by the subscriber.
      await this.outboxService.writeEvent(em, {
        kind: 'notification',
        transactionId: transaction.id,
        type: 'EMAIL',
        recipient: dto.userEmail,
        subject: `Hotel booking confirmation (Hotel ID: ${dto.hotelId})`,
        content: 'Your hotel booking is confirmed. Details...',
      } satisfies NotificationPayload);

      return {
        message: 'Hotel booking initiated',
        transactionId: transaction.id,
        bookingId: hotelBooking.id,
      };
    });
  }
}