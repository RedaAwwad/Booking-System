import {
  Injectable,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthGuard as KeycloakAuthGuard,
  KEYCLOAK_INSTANCE,
  KEYCLOAK_CONNECT_OPTIONS,
  KEYCLOAK_LOGGER,
  KEYCLOAK_MULTITENANT_SERVICE,
} from 'nest-keycloak-connect';
import { ClsService } from 'nestjs-cls';
import type { ClsStore } from '../cls/cls-store.interface';
import { Request } from 'express';
import { KeycloakSyncService } from '../../modules/auth/services/keycloak-sync.service';

export interface KeycloakTokenPayload {
  /** Keycloak user UUID — stored as `keycloakId` in the local `users` table. */
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  preferred_username?: string;
}

@Injectable()
export class AuthGuard extends KeycloakAuthGuard {
  constructor(
    @Inject(KEYCLOAK_INSTANCE) singleTenant: any,
    @Inject(KEYCLOAK_CONNECT_OPTIONS) keycloakOpts: any,
    @Inject(KEYCLOAK_LOGGER) logger: any,
    @Inject(KEYCLOAK_MULTITENANT_SERVICE) multiTenant: any,
    reflector: Reflector,
    private readonly cls: ClsService<ClsStore>,
    private readonly syncService: KeycloakSyncService,
  ) {
    super(singleTenant, keycloakOpts, logger, multiTenant, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isActivated = await super.canActivate(context);

    if (isActivated) {
      const request = context.switchToHttp().getRequest<Request & { user: KeycloakTokenPayload }>();

      if (request?.user?.sub) {
        // Sync the KC user into the local DB (no-op after first login).
        // localUser.id is the Postgres UUID we use everywhere in the app
        // (audit logs, FK constraints, etc.) — NOT the KC sub.
        const localUser = await this.syncService.syncUser(request.user);
        this.cls.set('userId', localUser.id);
      }
    }

    return isActivated;
  }
}
