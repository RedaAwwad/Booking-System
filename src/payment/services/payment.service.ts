// src/payment/services/payment.service.ts
import {
    Injectable,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStrategyFactory } from '../strategies/payment-strategy.factory';
import { TransactionRepository } from '../repositories/transaction.repository';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';

@Injectable()
export class PaymentService {
    constructor(
        private readonly strategyFactory: PaymentStrategyFactory,
        private readonly transactionRepo: TransactionRepository,
        private readonly attemptRepo: PaymentAttemptRepository,
    ) { }

    async initiatePayment(dto: InitiatePaymentDto) {
        const orderId = `order_${uuidv4()}`;
        const idempotencyKey = orderId;

        // Idempotency check
        const existing = await this.attemptRepo.findByIdempotencyKey(idempotencyKey);
        if (existing) {
            const ageSec = (Date.now() - existing.createdAt.getTime()) / 1000;

            if (existing.status === PaymentAttemptStatus.SUCCESS && ageSec < 60) {
                throw new ConflictException('Payment already processed successfully');
            }

            if (existing.status === PaymentAttemptStatus.PENDING && ageSec < 300) {
                throw new ConflictException('Payment is in progress, please wait');
            }

            if (existing.status === PaymentAttemptStatus.PENDING && ageSec >= 300) {
                await this.attemptRepo.updateStatus(idempotencyKey, PaymentAttemptStatus.FAILED);
            }
        }

        // Create transaction (ORDER FIRST)
        await this.transactionRepo.create({
            orderId,
            bookingId: dto.bookingId,
            amount: dto.amount,
            currency: dto.currency || 'USD',
        });

        // Create payment attempt
        try {
            await this.attemptRepo.create({
                idempotencyKey,
                orderId,
                provider: dto.provider,
            });
        } catch (err: any) {
            if (err.code === '23505') {
                throw new ConflictException('Payment already in progress (concurrent request)');
            }
            throw err;
        }

        // Call provider
        const strategy = this.strategyFactory.getStrategy(dto.provider);
        const result = await strategy.createPaymentIntent(
            dto.amount,
            orderId,
            dto.bookingId,
            dto.email

        );

        // Add result
        await this.attemptRepo.updateAttempt(idempotencyKey, {
            transactionId: result.paymentIntentId,
            responseData: result,
        });

        return {
            orderId,
            approvalUrl: result.approvalUrl,
            paymentIntentId: result.paymentIntentId,
        };
    }

    async capturePayment(orderId: string) {
        const attempt = await this.attemptRepo.findByOrderId(orderId);
        if (!attempt) {
            throw new BadRequestException('No payment attempt found');
        }

        const strategy = this.strategyFactory.getStrategy(attempt.provider as any);
        const result = await strategy.capturePayment(attempt.transactionId, orderId);

        if (result.success) {
            await this.transactionRepo.updateStatus(orderId, TransactionStatus.COMPLETED);
            await this.attemptRepo.updateStatus(
                attempt.idempotencyKey,
                PaymentAttemptStatus.SUCCESS,
            );
        } else {
            await this.transactionRepo.updateStatus(orderId, TransactionStatus.FAILED);
            await this.attemptRepo.updateStatus(
                attempt.idempotencyKey,
                PaymentAttemptStatus.FAILED,
            );
        }

        return result;
    }

    async getPaymentStatus(orderId: string) {
        const transaction = await this.transactionRepo.findByOrderId(orderId);
        if (!transaction) {
            throw new BadRequestException('Order not found');
        }

        return {
            orderId: transaction.orderId,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
        };
    }
}