import { Module, Global } from '@nestjs/common';
import { KeycloakConnectModule, TokenValidation } from 'nest-keycloak-connect';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { KeycloakSyncService } from './services/keycloak-sync.service';

@Global()
@Module({
  imports: [
    KeycloakConnectModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        authServerUrl: configService.get('DOCKER_ENV') === 'true'
          ? configService.getOrThrow<string>('KEYCLOAK_INTERNAL_URL')
          : configService.getOrThrow<string>('KEYCLOAK_URL'),
        realm: configService.getOrThrow<string>('KEYCLOAK_REALM'),
        clientId: configService.getOrThrow<string>('KEYCLOAK_CLIENT_ID'),
        secret: configService.get<string>('KEYCLOAK_CLIENT_SECRET') || '',
        bearerOnly: true, // REST API — never redirect to KC login page
        tokenValidation: TokenValidation.OFFLINE,
        useNestLogger: true,
      }),
      inject: [ConfigService],
    }),
    UserModule, // needed so KeycloakSyncService can inject UserService
  ],
  providers: [KeycloakSyncService],
  exports: [KeycloakConnectModule, KeycloakSyncService],
})
export class KeycloakModule {}
