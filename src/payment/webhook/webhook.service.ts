// src/payment/webhook/webhook.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';

@Injectable()
export class WebhookService {
    constructor(
        private readonly attemptRepo: PaymentAttemptRepository,
        private readonly transactionRepo: TransactionRepository,
    ) { }

    async handlePayPalWebhook(payload: any) {
        const eventType = payload.event_type;
        const purchaseUnit = payload.resource?.purchase_units?.[0];
        const orderId = purchaseUnit?.custom_id;

        if (!orderId) {
            throw new Error('No orderId in webhook payload');
        }

        const idempotencyKey = `order_${orderId}`;

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                const existing = await this.attemptRepo.findByIdempotencyKey(idempotencyKey);
                if (existing?.status === PaymentAttemptStatus.SUCCESS) {
                    return; // Already processed
                }

                await this.transactionRepo.updateStatus(orderId, TransactionStatus.COMPLETED);
                await this.attemptRepo.updateStatus(
                    idempotencyKey,
                    PaymentAttemptStatus.SUCCESS,
                    payload.resource.id,
                );
                break;

            case 'PAYMENT.CAPTURE.DENIED':
                await this.transactionRepo.updateStatus(orderId, TransactionStatus.FAILED);
                await this.attemptRepo.updateStatus(
                    idempotencyKey,
                    PaymentAttemptStatus.FAILED,
                );
                break;
        }
    }
}