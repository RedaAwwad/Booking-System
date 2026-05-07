// src/payment/strategies/payment-strategy.interface.ts
export interface PaymentInitiationResult {
    approvalUrl?: string;
    clientSecret?: string;
    paymentIntentId: string;
}

export interface PaymentCaptureResult {
    success: boolean;
    transactionId: string;
    message?: string;
}

export interface IPaymentStrategy {
    createPaymentIntent(
        amount: number,
        metadata: {
            orderId: string;
            bookingId: string;
            email: string;
        },
        idempotencyKey: string,
    ): Promise<PaymentInitiationResult>;

    capturePayment(
        paymentIntentId: string,
        orderId: string,
    ): Promise<PaymentCaptureResult>;
}