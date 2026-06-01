import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hotel_bookings')
export class HotelBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'transaction_id', unique: true })
  transactionId: string;

  @Column({ type: 'varchar', length: 100, name: 'hotel_id' })
  hotelId: string;

  @Column({ type: 'date', name: 'check_in' })
  checkIn: string;

  @Column({ type: 'date', name: 'check_out' })
  checkOut: string;

  @Column({ type: 'varchar', length: 50, name: 'room_type' })
  roomType: string;

  @Column({ type: 'int', name: 'guests_count' })
  guestsCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'total_price' })
  totalPrice: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: 'CONFIRMED' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
