import { SetMetadata } from '@nestjs/common';
import { RoleKey } from '../enums/role-key.enum';

export const Roles = (...roles: RoleKey[]) => SetMetadata('roles', roles);
