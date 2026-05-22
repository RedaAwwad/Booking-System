// src/payment/strategies/paypal.strategy.ts
import { Injectable } from '@nestjs/common';
import { IPaymentStrategy, PaymentInitiationResult, PaymentCaptureResult } from './payment-strategy.interface';

const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

@Injectable()
export class PayPalStrategy implements IPaymentStrategy {
    private paypalClient: any;

    constructor() {
        const clientId = process.env.PAYPAL_CLIENT_ID || 'test';
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'test';
        const environment = new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
        this.paypalClient = new checkoutNodeJssdk.core.PayPalHttpClient(environment);
    }

    async createPaymentIntent(
        amount: number,
        orderId: string, bookingId: string, email: string
    ): Promise<PaymentInitiationResult> {
        const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: orderId,
                    custom_id: orderId,
                    description: `Booking ${bookingId}`,
                    amount: {
                        currency_code: 'USD',
                        value: amount.toFixed(2),
                    },
                },
            ],
            application_context: {
                brand_name: 'Booking System',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?orderId=${orderId}`,
                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?orderId=${orderId}`,
            },
        });

        const response = await this.paypalClient.execute(request);
        const paypalOrderId = response.result.id;
        const approvalUrl = response.result.links.find((link: any) => link.rel === 'approve')?.href;

        if (!approvalUrl) {
            throw new Error('No approval URL from PayPal');
        }

        return {
            approvalUrl,
            paymentIntentId: paypalOrderId,
        };
    }

    async capturePayment(
        paymentIntentId: string,
        orderId: string,
    ): Promise<PaymentCaptureResult> {
        //paymentIntentId is at paypal
        const request = new checkoutNodeJssdk.orders.OrdersCaptureReques(paymentIntentId);
        request.requestBody({});

        //The transactionid is the same as paymentintentid
        try {
            const response = await this.paypalClient.execute(request);
            const status = response.result.status;

            if (status === 'COMPLETED') {
                return { success: true, transactionId: paymentIntentId };
            } else {
                return {
                    success: false,
                    transactionId: paymentIntentId,
                    message: `PayPal returned status: ${status}`,
                };
            }
        } catch (error: any) {
            return {
                success: false,
                transactionId: paymentIntentId,
                message: error.message,
            };
        }
    }
}