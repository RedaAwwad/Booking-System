import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    
    if (!user?.isAdmin) {
      throw new ForbiddenException('Access denied. Admins only.');
    }
    
    return true;
  }
}
