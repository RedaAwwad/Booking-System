import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { KeycloakAdminService } from '../services/keycloak-admin.service';

@ApiTags('Admin — User Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard) // Requires valid KC token + realm role `admin`
@Controller('admin/users')
export class AdminController {
  constructor(private readonly kcAdmin: KeycloakAdminService) {}

  /**
   * Fetch a user's live KC profile (enabled flag, email, name, etc.)
   * Useful for the admin dashboard without coupling to the local DB.
   */
  @Get(':keycloakId')
  @ApiOperation({ summary: 'Get KC user profile by Keycloak ID' })
  @ApiParam({ name: 'keycloakId', description: 'The KC user UUID (sub claim)' })
  @ApiOkResponse({ description: 'KC user profile returned' })
  @ApiNotFoundResponse({ description: 'User not found in Keycloak' })
  @ApiForbiddenResponse({ description: 'Caller does not have admin role' })
  getUser(@Param('keycloakId', ParseUUIDPipe) keycloakId: string) {
    return this.kcAdmin.getKcUser(keycloakId);
  }

  /**
   * Blocks a user:
   *   1. Sets enabled=false in Keycloak
   *   2. Revokes all active KC sessions (existing tokens stop working immediately)
   *   3. Sets isActive=false in the local users table
   */
  @Patch(':keycloakId/block')
  @ApiOperation({ summary: 'Block a user (disable in KC + revoke sessions + mark inactive locally)' })
  @ApiParam({ name: 'keycloakId', description: 'The KC user UUID (sub claim)' })
  @ApiOkResponse({ description: 'User blocked and sessions revoked' })
  @ApiNotFoundResponse({ description: 'User not found in Keycloak' })
  @ApiForbiddenResponse({ description: 'Caller does not have admin role' })
  blockUser(@Param('keycloakId', ParseUUIDPipe) keycloakId: string) {
    return this.kcAdmin.blockUser(keycloakId);
  }

  /**
   * Activates a user:
   *   1. Sets enabled=true in Keycloak
   *   2. Sets isActive=true in the local users table
   */
  @Patch(':keycloakId/activate')
  @ApiOperation({ summary: 'Activate a user (re-enable in KC + mark active locally)' })
  @ApiParam({ name: 'keycloakId', description: 'The KC user UUID (sub claim)' })
  @ApiOkResponse({ description: 'User activated successfully' })
  @ApiNotFoundResponse({ description: 'User not found in Keycloak' })
  @ApiForbiddenResponse({ description: 'Caller does not have admin role' })
  activateUser(@Param('keycloakId', ParseUUIDPipe) keycloakId: string) {
    return this.kcAdmin.activateUser(keycloakId);
  }
}
