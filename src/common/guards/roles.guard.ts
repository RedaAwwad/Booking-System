import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleKey } from '../enums/role-key.enum';
import type { KeycloakTokenPayload } from './auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleKey[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // request.user is now a KeycloakTokenPayload — roles live in realm_access.roles
    const { user } = context.switchToHttp().getRequest<{ user: KeycloakTokenPayload }>();

    if (!user || !user.realm_access?.roles) {
      throw new ForbiddenException('Forbidden resource');
    }

    const hasRole = requiredRoles.some((role) => user.realm_access?.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}