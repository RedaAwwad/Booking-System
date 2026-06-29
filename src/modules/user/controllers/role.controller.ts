import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { RoleKey } from '../../../common/enums/role-key.enum';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findAllRoles() {
    return this.roleService.findAllRoles();
  }

  @Post()
  async createRole(@Body() body: { name: string; desc?: string; key: RoleKey }) {
    return this.roleService.createRole(body);
  }

  @Delete(':id')
  async removeRoleById(@Param('id') id: string) {
    return this.roleService.removeRoleById(id);
  }
}
