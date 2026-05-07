// src/payment/entities/payment-attempt.entity.ts
import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

@Entity('payment_attempts')
export class PaymentAttempt {
    @PrimaryColumn()
    idempotencyKey: string;

    @Column()
    orderId: string;

    @Column()
    provider: string;

    @Column({
        type: 'enum',
        enum: PaymentAttemptStatus,
        default: PaymentAttemptStatus.PENDING,
    })
    status: PaymentAttemptStatus;

    @Column({ nullable: true })
    transactionId: string;

    @Column('jsonb', { nullable: true })
    responseData: any;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}