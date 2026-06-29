import { Controller, Get, Patch, Post, Body, UseGuards, Param, Put, Delete } from '@nestjs/common';
import { CustomerService } from '../services/customer.service';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('customers')
@UseGuards(AuthGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Patch('deactivate')
  async deactivateAccount(@CurrentUser() user: any) {
    const customerId = user.customerId;
    const result = await this.customerService.deactivateAccount(customerId);
    return { success: true, message: 'Customer account deactivated successfully', data: result };
  }

  // Address Management
  @Post('addresses')
  async createAddress(@CurrentUser() user: any, @Body() body: any) {
    const customerId = user.customerId;
    const address = await this.customerService.addAddress(customerId, body);
    return { success: true, data: address };
  }

  @Get('addresses')
  async getMyAddresses(@CurrentUser() user: any) {
    const customerId = user.customerId;
    const addresses = await this.customerService.getAddresses(customerId);
    return { success: true, data: addresses };
  }

  @Put('addresses/:addressId')
  async updateAddress(@CurrentUser() user: any, @Param('addressId') addressId: string, @Body() body: any) {
    const customerId = user.customerId;
    await this.customerService.updateAddress(customerId, addressId, body);
    return { success: true, message: 'Address updated successfully' };
  }

  @Delete('addresses/:addressId')
  async deleteAddress(@CurrentUser() user: any, @Param('addressId') addressId: string) {
    const customerId = user.customerId;
    await this.customerService.deleteAddress(customerId, addressId);
    return { success: true, message: 'Address deleted successfully' };
  }
}
