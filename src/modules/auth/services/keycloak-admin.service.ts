import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../user/services/user.service';

export interface KcUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  realmRoles?: string[];
}

/**
 * Wraps the Keycloak Admin REST API.
 *
 * Auth strategy: password-grant on the master realm using the
 * `admin-cli` client (the KC default for admin tooling). The token
 * is cached in memory and refreshed 30 s before expiry, or immediately
 * on a 401 response from the Admin API (one automatic retry).
 *
 * All mutations are mirrored to the local `users` table so that the
 * `isActive` flag stays consistent without requiring a KC round-trip
 * on every authenticated request.
 */
@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);

  private readonly kcUrl: string;
  private readonly realm: string;
  private readonly adminUser: string;
  private readonly adminPass: string;

  /** Simple in-memory token cache — single NestJS process is sufficient. */
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    configService: ConfigService,
    private readonly http: HttpService,
    private readonly userService: UserService,
  ) {
    // Use internal hostname inside Docker, public URL for local `npm run dev`
    this.kcUrl =
      configService.get('DOCKER_ENV') === 'true'
        ? configService.getOrThrow<string>('KEYCLOAK_INTERNAL_URL')
        : configService.getOrThrow<string>('KEYCLOAK_URL');

    this.realm     = configService.getOrThrow<string>('KEYCLOAK_REALM');
    this.adminUser = configService.getOrThrow<string>('KC_ADMIN_USER');
    this.adminPass = configService.getOrThrow<string>('KC_ADMIN_PASSWORD');
  }

  // ── Admin token management ───────────────────────────────────────────────

  private async getAdminToken(forceRefresh = false): Promise<string> {
    const BUFFER_MS = 30_000; // refresh 30 s before actual expiry
    if (!forceRefresh && this.cachedToken && Date.now() < this.tokenExpiresAt - BUFFER_MS) {
      return this.cachedToken;
    }

    this.logger.verbose('Fetching fresh KC admin token from master realm');

    const url  = `${this.kcUrl}/realms/master/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id:  'admin-cli',
      username:   this.adminUser,
      password:   this.adminPass,
    });

    try {
      const { data } = await firstValueFrom(
        this.http.post<{ access_token: string; expires_in: number }>(
          url,
          body.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      this.cachedToken     = data.access_token;
      this.tokenExpiresAt  = Date.now() + data.expires_in * 1_000;
      return this.cachedToken;
    } catch (err) {
      this.logger.error('Failed to obtain KC admin token', err?.response?.data);
      throw new BadGatewayException('Could not authenticate with Keycloak Admin API');
    }
  }

  /**
   * Wraps any Admin API call with automatic token refresh on 401.
   */
  private async callAdmin<T>(
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await fn(await this.getAdminToken());
    } catch (err) {
      if (err?.response?.status === 401) {
        this.logger.warn('Admin token expired mid-request, retrying with fresh token');
        return fn(await this.getAdminToken(true));
      }
      throw err;
    }
  }

  // ── KC Admin REST API helpers ────────────────────────────────────────────

  private userUrl(keycloakId: string): string {
    return `${this.kcUrl}/admin/realms/${this.realm}/users/${keycloakId}`;
  }

  private async assertUserExists(keycloakId: string, token: string): Promise<KcUser> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<KcUser>(this.userUrl(keycloakId), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return data;
    } catch (err) {
      if (err?.response?.status === 404) {
        throw new NotFoundException(`Keycloak user ${keycloakId} not found`);
      }
      throw new BadGatewayException('Keycloak Admin API error: ' + (err?.response?.data?.error ?? err.message));
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetches the KC user record.
   * Useful for admin dashboards — returns KC-side data without a DB round-trip.
   */
  async getKcUser(keycloakId: string): Promise<KcUser> {
    return this.callAdmin((token) => this.assertUserExists(keycloakId, token));
  }

  /**
   * Disables the user in Keycloak AND marks `isActive = false` in the local DB.
   * Also logs out all active KC sessions so existing tokens stop working immediately.
   */
  async blockUser(keycloakId: string): Promise<{ message: string }> {
    await this.callAdmin(async (token) => {
      // Verify user exists before mutating
      await this.assertUserExists(keycloakId, token);

      // 1. Disable user in KC
      await firstValueFrom(
        this.http.put(
          this.userUrl(keycloakId),
          { enabled: false },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      // 2. Revoke all active sessions — tokens issued before now are invalidated
      await firstValueFrom(
        this.http.post(
          `${this.userUrl(keycloakId)}/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ).catch(() => {
        // Non-fatal: user may have had no active sessions
        this.logger.warn(`Could not revoke KC sessions for user ${keycloakId}`);
      });
    });

    // 3. Mirror state to local DB
    const localUser = await this.userService.findUserIdByKeycloakId(keycloakId);
    if (localUser) {
      await this.userService.updateUserById(localUser.id, { isActive: false });
    }

    this.logger.log(`Blocked KC user ${keycloakId}`);
    return { message: 'User blocked and all sessions revoked' };
  }

  /**
   * Re-enables the user in Keycloak AND marks `isActive = true` in the local DB.
   */
  async activateUser(keycloakId: string): Promise<{ message: string }> {
    await this.callAdmin(async (token) => {
      await this.assertUserExists(keycloakId, token);

      await firstValueFrom(
        this.http.put(
          this.userUrl(keycloakId),
          { enabled: true },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
    });

    const localUser = await this.userService.findUserIdByKeycloakId(keycloakId);
    if (localUser) {
      await this.userService.updateUserById(localUser.id, { isActive: true });
    }

    this.logger.log(`Activated KC user ${keycloakId}`);
    return { message: 'User activated successfully' };
  }
}
