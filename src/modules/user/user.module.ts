import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { UserRepository } from './repositories/user.repository';
import { RoleService } from './services/role.service';
import { RoleRepository } from './repositories/role.repository';
import { UserController } from './controllers/user.controller';
import { RoleController } from './controllers/role.controller';
import { USER_MODULE_API } from './interfaces/user-module.interface';
import { UserModuleFacade } from './facades/user-module.facade';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserToken } from './entities/user-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, UserToken])],
  controllers: [UserController, RoleController],
  providers: [
    UserService,
    UserRepository,
    RoleService,
    RoleRepository,
    {
      provide: USER_MODULE_API,
      useClass: UserModuleFacade,
    },
  ],
  exports: [UserService, RoleService, USER_MODULE_API, TypeOrmModule],
})
export class UserModule {}
