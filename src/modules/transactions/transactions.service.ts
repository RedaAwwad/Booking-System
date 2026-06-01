import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  createWithEntityManager(
    em: EntityManager,
    input: {
      userId: string;
      amount: number;
      currency?: string;
      paymentMethod: string;
    },
  ): Promise<Transaction> {
    const transaction = em.create(Transaction, {
      ...input,
      status: TransactionStatus.PENDING,
    });
    return em.save(Transaction, transaction);
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<void> {
    await this.transactionRepository.update(id, { status });
  }
}
