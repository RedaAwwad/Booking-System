import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AdminGuard } from 'src/common/guards/admin.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('updateUserById')
  async updateUserById(@CurrentUser() user: any, @Body() body: any) {
    const result = await this.userService.updateUserById(user.userId, body);
    return { success: true, data: result };
  }

  @Post('updateIsActive')
  @UseGuards(AdminGuard)
  async updateIsActive(@Body('userId') userId: string) {
    const result = await this.userService.updateIsActive(userId);
    return { success: true, data: result };
  }

  @Post('findAndUpdateUserByEmail')
  async findAndUpdateUserByEmail(@CurrentUser() user: any, @Body() body: any) {
    const result = await this.userService.findAndUpdateUserByEmail(user.userId, user.userEmail, body);
    return { success: true, data: result };
  }

  @Post('findUserById')
  async findUserById(@Body('userId') userId: string) {
    const result = await this.userService.findUserById(userId);
    return { success: true, data: result };
  }

  @Post('assignRoleToUser')
  @UseGuards(AdminGuard)
  async assignRoleToUser(@Body() body: any) {
    const { userId, roleName } = body;
    const result = await this.userService.assignRoleToUser(userId, roleName);
    return { success: true, data: result, message: 'Role assigned successfully' };
  }

  @Post('removeRoleFromUser')
  @UseGuards(AdminGuard)
  async removeRoleFromUser(@Body() body: any) {
    const { userId, roleName } = body;
    const result = await this.userService.removeRoleFromUser(userId, roleName);
    return { success: true, data: result, message: 'Role removed successfully' };
  }
}
