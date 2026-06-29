import { Injectable } from '@nestjs/common';
import { IUserModuleApi } from '../interfaces/user-module.interface';
import { UserService } from '../services/user.service';
import { User } from '../entities/user.entity';
import { RoleKey } from '../../../common/enums/role-key.enum';
import { EntityManager, FindOptionsSelect } from 'typeorm';

@Injectable()
export class UserModuleFacade implements IUserModuleApi {
  constructor(private readonly userService: UserService) {}

  async findUserByEmail(email: string, select?: FindOptionsSelect<User>): Promise<User | null> {
    return this.userService.findUserByEmail(email, select);
  }

  async findUserById(userId: string, select?: FindOptionsSelect<User>): Promise<User | null> {
    return this.userService.findUserById(userId, select);
  }

  async createUser(data: Partial<User>, tx?: EntityManager): Promise<User> {
    return this.userService.createUser(data, tx);
  }

  async updateUserById(userId: string, data: Partial<User>): Promise<User> {
    return this.userService.updateUserById(userId, data);
  }

  async findAndUpdateUserByEmail(userId: string, email: string, data: Partial<User>): Promise<User> {
    return this.userService.findAndUpdateUserByEmail(userId, email, data);
  }

  async assignRoleToUser(userId: string, roleKey: RoleKey, tx?: EntityManager): Promise<boolean> {
    return this.userService.assignRoleToUser(userId, roleKey, tx);
  }
}
