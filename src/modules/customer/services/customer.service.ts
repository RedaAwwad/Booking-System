import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository } from '../repositories/customer.repository';
import { Customer } from '../entities/customer.entity';
import { EntityManager } from 'typeorm';
import { generateUUID } from 'src/common/utils/uuid.util';

@Injectable()
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async createCustomer(data: Partial<Customer>, tx?: EntityManager) {
    return this.customerRepository.createCustomer(data, tx);
  }

  async getCustomerByCustomerId(customerId: string) {
    return this.customerRepository.getCustomerByCustomerId(customerId);
  }

  async deactivateAccount(customerId: string) {
    const customer = await this.customerRepository.getCustomerByCustomerId(customerId);
    if (!customer) throw new NotFoundException('Customer Not found');

    return this.customerRepository.updateDeactivateAccount(customerId);
  }

  async getCustomerByUserId(userId: string) {
    return this.customerRepository.getCustomerByUserId(userId);
  }

  // Address Management
  async addAddress(customerId: string, data: any) {
    if (data.isPrimary) {
      await this.customerRepository.unsetPrimaryAddress(customerId);
    }
    const addressWithId = { id: generateUUID(), ...data };
    return this.customerRepository.addAddress(customerId, addressWithId);
  }

  async updateAddress(customerId: string, addressId: string, data: any) {
    if (data.isPrimary) {
      await this.customerRepository.unsetPrimaryAddress(customerId, addressId);
    }
    return this.customerRepository.updateAddress(customerId, addressId, data);
  }

  async deleteAddress(customerId: string, addressId: string) {
    return this.customerRepository.removeAddress(customerId, addressId);
  }

  async getAddresses(customerId: string) {
    return this.customerRepository.listAddresses(customerId);
  }
}
