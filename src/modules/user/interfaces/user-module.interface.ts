import { User } from '../entities/user.entity';
import { RoleKey } from '../../../common/enums/role-key.enum';
import { EntityManager, FindOptionsSelect } from 'typeorm';

export interface IUserModuleApi {
  findUserByEmail(email: string, select?: FindOptionsSelect<User>): Promise<User | null>;
  findUserById(userId: string, select?: FindOptionsSelect<User>): Promise<User | null>;
  createUser(data: Partial<User>, tx?: EntityManager): Promise<User>;
  updateUserById(userId: string, data: Partial<User>): Promise<User>;
  findAndUpdateUserByEmail(userId: string, email: string, data: Partial<User>): Promise<User>;
  assignRoleToUser(userId: string, roleKey: RoleKey, tx?: EntityManager): Promise<boolean>;
}

export const USER_MODULE_API = Symbol('USER_MODULE_API');
