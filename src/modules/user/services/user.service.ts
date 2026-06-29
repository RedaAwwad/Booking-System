import { Injectable, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsSelect } from 'typeorm';
import { UserRepository } from '../repositories/user.repository';
import { RoleService } from './role.service';
import { User } from '../entities/user.entity';
import { RoleKey } from '../../../common/enums/role-key.enum';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleService: RoleService,
  ) {}

  async createUser(data: Partial<User>, tx?: EntityManager) {
    return this.userRepository.createUser(data, tx);
  }

  async updateUserById(userId: string, data: Partial<User>) {
    return this.userRepository.updateUserById(userId, data);
  }

  async updateIsActive(userId: string) {
    return this.userRepository.updateIsActive(userId);
  }

  async findAndUpdateUserByEmail(userId: string, email: string, data: Partial<User>) {
    return this.userRepository.findAndUpdateUserByEmail(userId, email, data);
  }

  async findUserByEmail(email: string, select?: FindOptionsSelect<User>) {
    return this.userRepository.findUserByEmail(email, select);
  }

  async findUserById(userId: string, select?: FindOptionsSelect<User>) {
    return this.userRepository.findUserById(userId, select);
  }

  async assignRoleToUser(userId: string, roleKey: RoleKey, tx?: EntityManager) {
    const roleExists = await this.roleService.findRoleByKey(roleKey);
    if (!roleExists) throw new InternalServerErrorException('Role definition not found');

    const hasRole = await this.userRepository.hasRole(userId, roleKey, tx);
    if (hasRole) throw new ConflictException('User already has this role');

    await this.userRepository.assignRoleToUser(userId, roleKey, tx);
    return true;
  }

  async removeRoleFromUser(userId: string, roleKey: RoleKey, tx?: EntityManager) {
    const hasRole = await this.userRepository.hasRole(userId, roleKey, tx);
    if (!hasRole) throw new NotFoundException('User does not have this role');

    await this.userRepository.removeRoleFromUser(userId, roleKey, tx);
    return true;
  }
}
