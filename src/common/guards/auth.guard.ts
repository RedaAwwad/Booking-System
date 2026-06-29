import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { ClsService } from 'nestjs-cls';
import type { ClsStore } from '../cls/cls-store.interface';

interface JwtPayload {
  userId: string;
  name: string;
  email: string;
  userRoles: string[];
  customerId: string | null;
  isAdmin?: boolean;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly cls: ClsService<ClsStore>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('Unauthorized to perform this action!');

    try {
      const secret = this.configService.getOrThrow<string>('ACCESS_TOKEN_SECRET');
      const payload = jwt.verify(token, secret) as JwtPayload;

      request['user'] = payload;
      // Set userId in CLS here — guard already has the decoded payload.
      // Subscribers read this later inside transactions without any method threading.
      this.cls.set('userId', payload.userId);
    } catch (error) {
      if ((error as Error).name === 'TokenExpiredError') {
        throw new UnauthorizedException('Your token has expired!');
      }
      throw new UnauthorizedException('Unauthorized to perform this action!');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
