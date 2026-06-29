import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserTokenRepository } from '../repositories/user-token.repository';
import { TokenType } from '../../../common/enums/token-type.enum';

@Injectable()
export class UserTokenService {
  constructor(private readonly userTokenRepository: UserTokenRepository) {}

  async createToken(userId: string, token: string, tokenType: TokenType, expiresAt: Date) {
    // Usually, we want to invalidate previous tokens of the same type for this user
    await this.userTokenRepository.deleteTokensByUserIdAndType(userId, tokenType);
    return this.userTokenRepository.createToken(userId, token, tokenType, expiresAt);
  }

  async verifyToken(token: string, tokenType: TokenType) {
    const userToken = await this.userTokenRepository.findToken(token, tokenType);

    if (!userToken) {
      throw new NotFoundException('Invalid token');
    }

    if (new Date() > userToken.expiresAt) {
      await this.userTokenRepository.deleteToken(token);
      throw new UnauthorizedException('Token has expired');
    }

    return userToken;
  }

  async deleteToken(token: string) {
    await this.userTokenRepository.deleteToken(token);
  }

  async revokeAllUserTokens(userId: string) {
    await this.userTokenRepository.deleteAllTokensByUserId(userId);
  }

  async revokeAllUserTokensByType(userId: string, tokenType: TokenType) {
    await this.userTokenRepository.deleteAllTokensByUserIdAndType(userId, tokenType);
  }
}
