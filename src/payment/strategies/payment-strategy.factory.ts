// src/payment/strategies/payment-strategy.factory.ts
import { Injectable } from '@nestjs/common';
import { PayPalStrategy } from './paypal.strategy';
import { CODStrategy } from './cod.strategy';
import { IPaymentStrategy } from './payment-strategy.interface';
import { PaymentProvider } from '../dto/initiate-payment.dto';

@Injectable()
export class PaymentStrategyFactory {
    constructor(
        private readonly paypalStrategy: PayPalStrategy,
        private readonly codStrategy: CODStrategy,
    ) { }

    getStrategy(provider: PaymentProvider): IPaymentStrategy {
        switch (provider) {
            case PaymentProvider.PAYPAL:
                return this.paypalStrategy;
            case PaymentProvider.CASH_ON_DELIVERY:
                return this.codStrategy;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
}