// src/payment/jobs/stale-booking.cleanup.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionRepository } from '../repositories/transaction.repository';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

@Injectable()
export class StaleBookingCleanup {
    constructor(
        private readonly transactionRepo: TransactionRepository,
        private readonly attemptRepo: PaymentAttemptRepository,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async cleanUp() {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000);
        const staleTransactions = await this.transactionRepo.findStalePending(cutoff);

        for (const tx of staleTransactions) {
            await this.transactionRepo.updateStatus(tx.orderId, TransactionStatus.CANCELED);

            const idempotencyKey = `order_${tx.orderId}`;
            await this.attemptRepo.updateStatus(idempotencyKey, PaymentAttemptStatus.FAILED);
        }
    }
}