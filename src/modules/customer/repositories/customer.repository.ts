import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { Customer } from '../entities/customer.entity';

@Injectable()
export class CustomerRepository {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  async createCustomer(data: Partial<Customer>, tx?: EntityManager) {
    const repo = tx ? tx.getRepository(Customer) : this.customerRepository;
    const customer = repo.create(data);
    return repo.save(customer);
  }

  async getCustomerByCustomerId(id: string) {
    return this.customerRepository.findOne({ where: { id } });
  }

  async getCustomerByUserId(userId: string) {
    return this.customerRepository.findOne({ where: { userId } });
  }

  async updateDeactivateAccount(id: string) {
    const result = await this.customerRepository
      .createQueryBuilder()
      .update(Customer)
      .set({ deactivatedAt: new Date() })
      .where('id = :id', { id })
      .returning('*')
      .execute();
    return result.raw[0] ?? null;
  }

  // Address Management via TypeORM QueryBuilder and native SQL
  async addAddress(customerId: string, address: any) {
    const result = await this.customerRepository
      .createQueryBuilder()
      .update(Customer)
      .set({ addresses: () => `COALESCE(addresses, '[]'::jsonb) || :addr::jsonb` })
      .where('id = :id', { id: customerId })
      .setParameter('addr', JSON.stringify([address]))
      .returning('*')
      .execute();
    return result.raw[0] ?? null;
  }

  async unsetPrimaryAddress(customerId: string, exceptAddressId?: string) {
    await this.dataSource.query(
      `UPDATE customers
       SET addresses = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN elem->>'id' = $2 THEN elem
                ELSE jsonb_set(elem, '{isPrimary}', 'false')
           END
         ), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(addresses, '[]'::jsonb)) elem
       )
       WHERE id = $1`,
      [customerId, exceptAddressId ?? null],
    );
  }

  async updateAddress(customerId: string, addressId: string, data: any) {
    // We update the address array in-place atomically using jsonb_set and jsonb_agg
    await this.dataSource.query(
      `UPDATE customers
       SET addresses = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN elem->>'id' = $2 THEN 
             elem || $3::jsonb
           ELSE 
             elem
           END
         ), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(addresses, '[]'::jsonb)) elem
       )
       WHERE id = $1`,
      [customerId, addressId, JSON.stringify(data)],
    );
  }

  async removeAddress(customerId: string, addressId: string) {
    await this.dataSource.query(
      `UPDATE customers
       SET addresses = (
         SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(addresses, '[]'::jsonb)) elem
         WHERE elem->>'id' != $2
       )
       WHERE id = $1`,
      [customerId, addressId],
    );
  }

  async listAddresses(customerId: string) {
    const rows: { addresses: any[] }[] = await this.dataSource.query(
      `SELECT addresses FROM customers WHERE id = $1`,
      [customerId],
    );
    return rows[0]?.addresses ?? [];
  }
}
