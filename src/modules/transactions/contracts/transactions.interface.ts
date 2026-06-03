import { EntityManager } from 'typeorm';
import { TransactionStatus } from './transaction-status';

export { TransactionStatus };

export interface CreateTransactionInput {
  userId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
}

export interface TransactionRef {
  id: string;
}

export interface ITransactionsService {
  createInTransaction(
    em: EntityManager,
    input: CreateTransactionInput,
  ): Promise<TransactionRef>;

  updateStatus(id: string, status: TransactionStatus): Promise<void>;
}
