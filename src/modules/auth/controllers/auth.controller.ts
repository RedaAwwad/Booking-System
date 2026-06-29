import { Controller, Post, Body, UseGuards, Get, Patch, Query, Req, Res } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { SignupDto, LoginDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, SendVerificationEmailDto } from '../dto/auth.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);

    res.cookie('refresh_token', refreshToken, {
      maxAge: 60 * 60 * 24 * 90 * 1000, // 90 days in ms
      httpOnly: true,
    });

    return {
      success: true,
      data: {
        accessToken,
        user,
      },
    };
  }

  @Post('refresh-token')
  async refreshToken(@Req() req: Request) {
    const refreshToken = req.cookies?.refresh_token;

    const { accessToken, user } = await this.authService.refreshToken(refreshToken);
    return {
      success: true,
      message: 'Access token refreshed successfully.',
      data: { accessToken, user },
    };
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const result = await this.authService.logout(refreshToken);
    res.clearCookie('refresh_token');
    return result;
  }

  @UseGuards(AuthGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logoutAll(user.userId);
    res.clearCookie('refresh_token');
    return result;
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(token, dto);
  }

  @Post('send-verification-email')
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto) {
    return this.authService.sendVerificationEmail(dto);
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @UseGuards(AuthGuard)
  @Patch('change-password')
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return { success: true, data: user };
  }
}
