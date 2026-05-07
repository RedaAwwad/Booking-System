// src/payment/entities/transaction.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { TransactionStatus } from '../enums/transaction-status.enum';

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    orderId: string;

    @Column()
    bookingId: string;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({ default: 'USD' })
    currency: string;

    @Column({
        type: 'enum',
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    status: TransactionStatus;

    @Column({ nullable: true })
    userId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}