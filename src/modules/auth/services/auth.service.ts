import { Injectable, BadRequestException, ConflictException, UnauthorizedException, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import type { IUserModuleApi } from '../../user/interfaces/user-module.interface';
import { USER_MODULE_API } from '../../user/interfaces/user-module.interface';
import type { ICustomerModuleApi } from '../../customer/interfaces/customer-module.interface';
import { CUSTOMER_MODULE_API } from '../../customer/interfaces/customer-module.interface';

import { RoleKey } from '../../../common/enums/role-key.enum';
import { TokenType } from '../../../common/enums/token-type.enum';

import { SignupDto, LoginDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, SendVerificationEmailDto } from '../dto/auth.dto';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { UserTokenService } from './user-token.service';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_MODULE_API) private readonly userModuleFacade: IUserModuleApi,
    @Inject(CUSTOMER_MODULE_API) private readonly customerModuleFacade: ICustomerModuleApi,
    private readonly userTokenService: UserTokenService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.userModuleFacade.findUserByEmail(dto.email);
    if (existingUser) throw new ConflictException('Email is already registered!');

    const hashedPassword = await hashPassword(dto.password);

    // Using transaction for atomic signup
    const user = await this.dataSource.transaction(async (tx) => {
      const newUser = await this.userModuleFacade.createUser({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        isActive: true,
        isConfirmed: false, // will require email verification
      }, tx);

      await this.userModuleFacade.assignRoleToUser(newUser.id, RoleKey.CUSTOMER, tx);

      await this.customerModuleFacade.createCustomer({
        userId: newUser.id,
        phone: dto.phone,
      }, tx);

      return newUser;
    });

    // Fire-and-forget email verification (in real app, this should send an email)
    this.sendVerificationEmail({ email: user.email }).catch(console.error);

    return {
      message: 'Signup successful. Please verify your email.',
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModuleFacade.findUserByEmail(dto.email, {
      id: true, email: true, password: true, name: true,
      isActive: true, isConfirmed: true, isAdmin: true, roles: true,
    });
    
    if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');
    
    const isValidPassword = await verifyPassword(dto.password, user.password);
    if (!isValidPassword) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Your account is deactivated.');
    if (!user.isConfirmed) throw new UnauthorizedException('Please verify your email before logging in.');

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string) {
    const validToken = await this.userTokenService.verifyToken(refreshToken, TokenType.REFRESH);
    const user = await this.userModuleFacade.findUserById(validToken.userId);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid or deactivated user');

    // Invalidate old refresh token
    await this.userTokenService.deleteToken(refreshToken);

    return this.generateTokens(user);
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.userTokenService.deleteToken(refreshToken);
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.userTokenService.revokeAllUserTokens(userId);
    return { success: true, message: 'Logged out from all sessions' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModuleFacade.findUserByEmail(dto.email);
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const resetToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { secret: jwtSecret, expiresIn: 15 * 60 }, // 15 mins
    );

    const resetUrl = `${this.configService.get('PASSWORD_RESET_URL')}?token=${resetToken}`;
    console.log(`[Email Mock] Password reset link for ${user.email}: ${resetUrl}`);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, dto: ResetPasswordDto) {
    if (!token) throw new BadRequestException('Reset token is required');
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    let payload;
    try {
      payload = this.jwtService.verify(token, { secret: jwtSecret });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await hashPassword(dto.newPassword);
    await this.userModuleFacade.updateUserById(payload.userId, { password: hashedPassword });

    // Security: revoke all existing refresh tokens (force logout from all devices)
    await this.userTokenService.revokeAllUserTokensByType(payload.userId, TokenType.REFRESH);

    return { message: 'Password reset successful' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModuleFacade.findUserById(userId, { id: true, password: true });
    if (!user || !user.password) throw new NotFoundException('User not found');

    const isValid = await verifyPassword(dto.oldPassword, user.password);
    if (!isValid) throw new BadRequestException('Incorrect old password');

    const hashedPassword = await hashPassword(dto.newPassword);
    await this.userModuleFacade.updateUserById(userId, { password: hashedPassword });

    return { message: 'Password changed successfully' };
  }

  async sendVerificationEmail(dto: SendVerificationEmailDto) {
    const user = await this.userModuleFacade.findUserByEmail(dto.email);
    if (!user || user.isConfirmed) return { message: 'If an unverified account exists with that email, a verification link has been sent.' };

    // Generate a short-lived JWT verification token (same pattern as forgotPassword)
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const verificationToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { secret: jwtSecret, expiresIn: 24 * 60 * 60 }, // 24h
    );

    const verifyUrl = `${this.configService.get('EMAIL_VERIFICATION_URL')}?token=${verificationToken}`;
    console.log(`[Email Mock] Verification link for ${user.email}: ${verifyUrl}`);

    return { message: 'If an unverified account exists with that email, a verification link has been sent.' };
  }

  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Verification token is required');
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    let payload: { userId: string; email: string };
    try {
      payload = this.jwtService.verify(token, { secret: jwtSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    const user = await this.userModuleFacade.findUserByEmail(payload.email, { id: true, email: true, isConfirmed: true });
    if (!user) throw new NotFoundException('User not found');
    if (user.isConfirmed) throw new BadRequestException('Email is already verified');

    await this.userModuleFacade.findAndUpdateUserByEmail(user.id, user.email, { isConfirmed: true });
    return { message: 'Email verified successfully. You can now log in.' };
  }

  private async generateTokens(user: User) {
    const customer = await this.customerModuleFacade.getCustomerByUserId(user.id);

    const userRoles = [...(user.roles || [])];
    if (user.isAdmin && !userRoles.includes(RoleKey.ADMIN)) {
      userRoles.push(RoleKey.ADMIN);
    }

    const payload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      userRoles,
      customerId: customer?.id || null,
      isAdmin: user.isAdmin,
    };

    const accessTokenExpiry = this.configService.getOrThrow<number>('ACCESS_TOKEN_EXPIRY');
    const refreshTokenExpiry = this.configService.getOrThrow<number>('REFRESH_TOKEN_EXPIRY');
    const accessTokenSecret = this.configService.getOrThrow<string>('ACCESS_TOKEN_SECRET');
    const refreshTokenSecret = this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessTokenSecret,
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshTokenSecret,
      expiresIn: refreshTokenExpiry,
    });

    const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);

    await this.userTokenService.createToken(
      user.id,
      refreshToken,
      TokenType.REFRESH,
      refreshTokenExpiresAt
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: userRoles,
      },
    };
  }
}