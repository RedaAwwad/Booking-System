import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * Serves the login and PKCE callback pages.
 * These routes are excluded from the global `api/v1` prefix in main.ts.
 */
@ApiExcludeController()
@Controller()
export class LoginController {
  private readonly kcPublicUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly appPort: string;

  constructor(configService: ConfigService) {
    this.kcPublicUrl = configService.getOrThrow<string>('KEYCLOAK_URL');
    this.realm       = configService.getOrThrow<string>('KEYCLOAK_REALM');
    this.clientId    = configService.getOrThrow<string>('KEYCLOAK_CLIENT_ID');
    this.appPort     = configService.get<string>('PORT') ?? '3000';
  }

  /** Serves the login page. */
  @Get('login')
  loginPage(@Res() res: Response) {
    const callbackUrl = `http://localhost:${this.appPort}/auth/callback`;
    return res.render('login', {
      keycloakUrl: this.kcPublicUrl,
      realm:       this.realm,
      clientId:    this.clientId,
      callbackUrl,
    });
  }

  /**
   * Keycloak redirects back here after the user authenticates.
   * The JS in callback.ejs exchanges the authorization code for tokens.
   */
  @Get('auth/callback')
  callbackPage(
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    return res.render('callback', {
      keycloakUrl: this.kcPublicUrl,
      realm:       this.realm,
      clientId:    this.clientId,
      error:       error ?? null,
    });
  }

  /**
   * Log out of Keycloak SSO browser session and redirect back to login page.
   */
  @Get('auth/logout')
  logout(@Res() res: Response) {
    const logoutUrl = `${this.kcPublicUrl}/realms/${this.realm}/protocol/openid-connect/logout?client_id=${this.clientId}&post_logout_redirect_uri=http://localhost:${this.appPort}/auth/callback`;
    return res.redirect(logoutUrl);
  }

  @Get('logout')
  logoutShort(@Res() res: Response) {
    return this.logout(res);
  }
}
