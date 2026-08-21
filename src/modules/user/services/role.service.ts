import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { RoleRepository } from '../repositories/role.repository';
import { RoleKey } from '../../../common/enums/role-key.enum';

@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) { }

  async createRole(data: { name: string; desc?: string; key: RoleKey }) {
    const existingRole = await this.roleRepository.findRoleByKey(data.key);
    if (existingRole) {
      throw new ConflictException('Role with this key already exists');
    }
    return this.roleRepository.createRole(data);
  }

  async findAllRoles() {
    return this.roleRepository.findAll();
  }

  async findRoleByKey(roleKey: RoleKey) {
    return this.roleRepository.findRoleByKey(roleKey);
  }

  async removeRoleById(roleId: string) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundException(`Role '${roleId}' not found`);
    }

    await this.roleRepository.removeRoleById(role.id);
  }

  async removeRoleByName(roleKey: RoleKey) {
    const role = await this.roleRepository.findRoleByKey(roleKey);
    if (!role) {
      throw new InternalServerErrorException('Something went wrong!');
    }

    await this.roleRepository.removeRoleByKey(role.key);
  }
}