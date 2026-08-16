import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { LoginController } from './controllers/login.controller';
import { AdminController } from './controllers/admin.controller';
import { KeycloakAdminService } from './services/keycloak-admin.service';
import { HttpModule } from '@nestjs/axios';
import { UserModule } from '../user/user.module';
import { CustomerModule } from '../customer/customer.module';
import { KeycloakModule } from './keycloak.module';

@Module({
  imports: [
    HttpModule,
    UserModule,
    CustomerModule,
    KeycloakModule,
  ],
  controllers: [AuthController, LoginController, AdminController],
  providers: [KeycloakAdminService],
  exports: [KeycloakModule, KeycloakAdminService],
})
export class AuthModule { }
