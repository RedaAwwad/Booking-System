import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('flight_bookings')
export class FlightBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'transaction_id', unique: true })
  transactionId: string;

  @Column({ type: 'varchar', length: 50 })
  origin: string;

  @Column({ type: 'varchar', length: 50 })
  destination: string;

  @Column({ type: 'date', name: 'departure_date' })
  departureDate: string;

  @Column({ type: 'varchar', length: 50, name: 'cabin_class' })
  cabinClass: string;

  @Column({ type: 'int', name: 'adults_count' })
  adultsCount: number;

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
