import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './services/auth.service';
import { UserTokenService } from './services/user-token.service';
import { UserTokenRepository } from './repositories/user-token.repository';
import { AuthController } from './controllers/auth.controller';
import { UserModule } from '../user/user.module';
import { CustomerModule } from '../customer/customer.module';
import { Role } from '../user/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role]),  // for AuthService role queries
    JwtModule.register({}),
    UserModule,
    CustomerModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UserTokenService, UserTokenRepository],
  exports: [AuthService],
})
export class AuthModule {}
