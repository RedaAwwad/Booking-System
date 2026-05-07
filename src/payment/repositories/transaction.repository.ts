// src/payment/repositories/transaction.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';

@Injectable()
export class TransactionRepository {
    constructor(
        @InjectRepository(Transaction)
        private readonly repo: Repository<Transaction>,
    ) { }

    async create(data: {
        orderId: string;
        bookingId: string;
        amount: number;
        currency: string;
    }): Promise<Transaction> {
        const transaction = this.repo.create({
            orderId: data.orderId,
            bookingId: data.bookingId,
            amount: data.amount,
            currency: data.currency,
            status: TransactionStatus.PENDING,
        });
        return this.repo.save(transaction);
    }

    async findByOrderId(orderId: string): Promise<Transaction | null> {
        return this.repo.findOne({ where: { orderId } });
    }

    async updateStatus(orderId: string, status: TransactionStatus | string): Promise<void> {
        await this.repo.update({ orderId }, { status: status as TransactionStatus });
    }

    async findStalePending(cutoffDate: Date): Promise<Transaction[]> {
        return this.repo.find({
            where: {
                status: TransactionStatus.PENDING,
                createdAt: LessThan(cutoffDate),
            },
        });
    }
}