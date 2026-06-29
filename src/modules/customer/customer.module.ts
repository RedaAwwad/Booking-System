import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './services/customer.service';
import { CustomerRepository } from './repositories/customer.repository';
import { CustomerController } from './controllers/customer.controller';
import { CUSTOMER_MODULE_API } from './interfaces/customer-module.interface';
import { CustomerModuleFacade } from './facades/customer-module.facade';
import { Customer } from './entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  controllers: [CustomerController],
  providers: [
    CustomerService,
    CustomerRepository,
    {
      provide: CUSTOMER_MODULE_API,
      useClass: CustomerModuleFacade,
    },
  ],
  exports: [CustomerService, CUSTOMER_MODULE_API],
})
export class CustomerModule {}
