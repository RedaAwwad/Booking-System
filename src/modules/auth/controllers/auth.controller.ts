import { Controller, Post, UseGuards, Get, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { Response } from 'express';

@ApiTags('Auth — Keycloak Session')
@Controller('auth')
export class AuthController {
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user profile from CLS and Keycloak token' })
  @ApiOkResponse({ description: 'User profile returned successfully' })
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return { success: true, data: user };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out locally (clears legacy cookies if present)' })
  @ApiOkResponse({ description: 'Local session cleared' })
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return {
      success: true,
      message: 'Logged out locally. To terminate SSO, redirect to Keycloak OIDC logout endpoint.',
    };
  }
}
