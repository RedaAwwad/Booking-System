// src/payment/strategies/cod.strategy.ts
import { Injectable } from '@nestjs/common';
import { IPaymentStrategy, PaymentInitiationResult, PaymentCaptureResult } from './payment-strategy.interface';

@Injectable()
export class CODStrategy implements IPaymentStrategy {
    async createPaymentIntent(
        amount: number,
        metadata: { orderId: string; bookingId: string; email: string },
        idempotencyKey: string,
    ): Promise<PaymentInitiationResult> {
        return {
            paymentIntentId: `COD_${metadata.orderId}`,
        };
    }

    async capturePayment(
        paymentIntentId: string,
        orderId: string,
    ): Promise<PaymentCaptureResult> {
        return {
            success: true,
            transactionId: paymentIntentId,
        };
    }
}