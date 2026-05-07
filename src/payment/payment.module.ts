// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Transaction } from './entities/transaction.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { TransactionRepository } from './repositories/transaction.repository';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository';
import { PayPalStrategy } from './strategies/paypal.strategy';
import { CODStrategy } from './strategies/cod.strategy';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory';
import { PaymentService } from './services/payment.service';
import { WebhookService } from './webhook/webhook.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { StaleBookingCleanup } from './services/cron.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Transaction, PaymentAttempt]),
        ScheduleModule.forRoot(),
    ],
    controllers: [PaymentController, PaymentWebhookController],
    providers: [
        TransactionRepository,
        PaymentAttemptRepository,
        PayPalStrategy,
        CODStrategy,
        PaymentStrategyFactory,
        PaymentService,
        WebhookService,
        StaleBookingCleanup,
    ],
    exports: [PaymentService],
})
export class PaymentModule { }