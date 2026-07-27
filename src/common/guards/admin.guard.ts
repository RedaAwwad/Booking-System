import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { KeycloakTokenPayload } from './auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: KeycloakTokenPayload }>();

    // In KC tokens, admin status is expressed as a realm role, not a boolean flag
    const isAdmin = user?.realm_access?.roles?.includes('admin') ?? false;

    if (!isAdmin) {
      throw new ForbiddenException('Access denied. Admins only.');
    }

    return true;
  }
}
