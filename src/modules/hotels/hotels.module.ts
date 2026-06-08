import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { OutboxModule } from '../outbox/outbox.module';
import { HotelBooking } from './entities/hotel-booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HotelBooking]),
    TransactionsModule,
    OutboxModule,
  ],
  controllers: [HotelsController],
  providers: [HotelsService],
})
export class HotelsModule {}
