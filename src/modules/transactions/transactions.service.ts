import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  CreateTransactionInput,
  ITransactionsService,
  TransactionRef,
  TransactionStatus,
} from './contracts/transactions.interface';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionsService implements ITransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async createInTransaction(
    em: EntityManager,
    input: CreateTransactionInput,
  ): Promise<TransactionRef> {
    const transaction = em.create(Transaction, {
      ...input,
      status: TransactionStatus.PENDING,
    });
    const saved = await em.save(Transaction, transaction);
    return { id: saved.id };
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<void> {
    await this.transactionRepository.update(id, { status });
  }
}
