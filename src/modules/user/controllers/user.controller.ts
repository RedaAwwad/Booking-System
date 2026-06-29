import { Controller, Get, Param, Patch } from '@nestjs/common';
import { UserService } from '../services/user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch(':id/activate')
  async toggleUserActiveStatus(@Param('id') id: string) {
    return this.userService.updateIsActive(id);
  }
}
