import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserToken } from '../../user/entities/user-token.entity';
import { TokenType } from '../../../common/enums/token-type.enum';

@Injectable()
export class UserTokenRepository {
  constructor(
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
  ) {}

  async createToken(userId: string, token: string, tokenType: TokenType, expiresAt: Date) {
    const userToken = this.userTokenRepository.create({
      userId,
      token,
      tokenType,
      expiresAt,
    });
    return this.userTokenRepository.save(userToken);
  }

  async findToken(token: string, tokenType: TokenType) {
    return this.userTokenRepository.findOne({ where: { token, tokenType } });
  }

  async deleteTokensByUserIdAndType(userId: string, tokenType: TokenType) {
    await this.userTokenRepository.delete({ userId, tokenType });
  }

  async deleteToken(token: string) {
    await this.userTokenRepository.delete({ token });
  }

  async deleteAllTokensByUserId(userId: string) {
    await this.userTokenRepository.delete({ userId });
  }

  async deleteAllTokensByUserIdAndType(userId: string, tokenType: TokenType) {
    await this.userTokenRepository.delete({ userId, tokenType });
  }
}
