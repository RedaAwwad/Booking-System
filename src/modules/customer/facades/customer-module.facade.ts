import { Injectable } from '@nestjs/common';
import { ICustomerModuleApi } from '../interfaces/customer-module.interface';
import { CustomerService } from '../services/customer.service';
import { Customer } from '../entities/customer.entity';
import { EntityManager } from 'typeorm';

@Injectable()
export class CustomerModuleFacade implements ICustomerModuleApi {
  constructor(private readonly customerService: CustomerService) {}

  async getCustomerByUserId(userId: string): Promise<Customer | null> {
    return this.customerService.getCustomerByUserId(userId);
  }

  async createCustomer(data: Partial<Customer>, tx?: EntityManager): Promise<Customer> {
    return this.customerService.createCustomer(data, tx);
  }
}
