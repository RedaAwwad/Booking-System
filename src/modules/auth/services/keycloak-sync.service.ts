import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/services/user.service';
import { User } from '../../user/entities/user.entity';
import type { KeycloakTokenPayload } from '../../../common/guards/auth.guard';

/**
 * Bridges Keycloak identity with the local `users` table.
 *
 * On every authenticated request the guard calls `syncUser()`:
 *   - Fast-path: user already exists → return immediately (one DB read).
 *   - First login: create a local row from KC token claims → return.
 *
 * This keeps our DB in sync with KC without requiring a separate
 * provisioning step when new users register through Keycloak.
 */
@Injectable()
export class KeycloakSyncService {
  private readonly logger = new Logger(KeycloakSyncService.name);

  constructor(private readonly userService: UserService) {}

  async syncUser(payload: KeycloakTokenPayload): Promise<User> {
    // 1. Fast-path: known user
    const existing = await this.userService.findUserByKeycloakId(payload.sub);
    if (existing) return existing;

    // 2. First login — auto-provision from KC token claims
    this.logger.log(`First login for KC user ${payload.sub} (${payload.email}), provisioning local record`);

    const isAdmin = payload.realm_access?.roles?.includes('admin') ?? false;

    const newUser = await this.userService.createUser({
      keycloakId: payload.sub,
      email: payload.email,
      // KC provides full name in `name`, or fall back to preferred_username or email
      name: payload.name ?? payload.preferred_username ?? payload.email,
      isActive: true,
      isAdmin,
    });

    this.logger.log(`Provisioned local user ${newUser.id} for KC sub ${payload.sub}`);
    return newUser;
  }
}
