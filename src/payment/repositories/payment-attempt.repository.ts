// src/payment/repositories/payment-attempt.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentAttempt } from '../entities/payment-attempt.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

@Injectable()
export class PaymentAttemptRepository {
    constructor(
        @InjectRepository(PaymentAttempt)
        private readonly repo: Repository<PaymentAttempt>,
    ) { }

    async create(data: {
        idempotencyKey: string;
        orderId: string;
        provider: string;
    }): Promise<PaymentAttempt> {
        const attempt = this.repo.create({
            idempotencyKey: data.idempotencyKey,
            orderId: data.orderId,
            provider: data.provider,
            status: PaymentAttemptStatus.PENDING,
        });
        return this.repo.save(attempt);
    }

    async findByIdempotencyKey(key: string): Promise<PaymentAttempt | null> {
        return this.repo.findOne({ where: { idempotencyKey: key } });
    }

    async findByOrderId(orderId: string): Promise<PaymentAttempt | null> {
        return this.repo.findOne({ where: { orderId } });
    }

    async updateAttempt(
        idempotencyKey: string,
        data: {
            status?: PaymentAttemptStatus;
            transactionId?: string;
            responseData?: any;
        },
    ): Promise<void> {
        const update: any = {};
        if (data.status !== undefined) update.status = data.status;
        if (data.transactionId !== undefined) update.transactionId = data.transactionId;
        if (data.responseData !== undefined) update.responseData = data.responseData;
        await this.repo.update({ idempotencyKey }, update);
    }

    async updateStatus(
        idempotencyKey: string,
        status: PaymentAttemptStatus,
        transactionId?: string,
    ): Promise<void> {
        const update: any = { status };
        if (transactionId) update.transactionId = transactionId;
        await this.repo.update({ idempotencyKey }, update);
    }
}