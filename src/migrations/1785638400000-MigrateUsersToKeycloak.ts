import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrates the `users` table to Keycloak-managed identity.
 *
 * Strategy: CLEAN SLATE
 *   - Only one development user existed; they will be re-registered
 *     via Keycloak's auto-provisioning on first login after KC is live.
 *
 * Changes:
 *   - TRUNCATE users CASCADE   (removes all existing rows + dependent rows)
 *   - DROP COLUMN password     (KC handles authentication)
 *   - DROP COLUMN isConfirmed  (KC handles email verification)
 *   - DROP COLUMN roles        (KC is now the role authority)
 *   - ADD COLUMN keycloakId    (NOT NULL UNIQUE — the KC sub claim)
 *
 * WARNING: Run this migration ONLY after Keycloak is up and your admin
 * user is registered in the booking-realm. Otherwise you will lose access.
 */
export class MigrateUsersToKeycloak1785638400000 implements MigrationInterface {
  name = 'MigrateUsersToKeycloak1785638400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Clean slate — removes existing users and anything FK-dependent on them
    //    (customers, user_roles, user_tokens will cascade-delete)
    await queryRunner.query(`TRUNCATE TABLE "users" CASCADE`);

    // 2. Drop legacy auth columns
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isConfirmed"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "roles"`);

    // 3. Add Keycloak identity column — NOT NULL because every user MUST
    //    have a KC identity; there is no other way to authenticate.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "keycloakId" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_keycloakId" UNIQUE ("keycloakId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse — restore legacy schema (data cannot be recovered)
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_keycloakId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "keycloakId"`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "roles" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "isConfirmed" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "password" character varying(255) NOT NULL DEFAULT ''`);
  }
}
