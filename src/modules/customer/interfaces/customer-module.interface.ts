import { Customer } from '../entities/customer.entity';
import { EntityManager } from 'typeorm';

export interface ICustomerModuleApi {
  getCustomerByUserId(userId: string): Promise<Customer | null>;
  createCustomer(data: Partial<Customer>, tx?: EntityManager): Promise<Customer>;
}

export const CUSTOMER_MODULE_API = Symbol('CUSTOMER_MODULE_API');
