import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedDefaultRoles1782999999999 implements MigrationInterface {
    name = 'SeedDefaultRoles1782999999999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Idempotent: safe to re-run; skips rows whose key already exists.
        await queryRunner.query(
            `INSERT INTO "roles" ("key", "name", "desc") VALUES
                ('CUSTOMER', 'Customer', 'Default role assigned at signup'),
                ('ADMIN', 'Admin', 'Administrative role with full access')
            ON CONFLICT ("key") DO NOTHING`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "roles" WHERE "key" IN ('CUSTOMER', 'ADMIN') AND "id" NOT IN (SELECT "roleId" FROM "user_roles")`,
        );
    }
}
