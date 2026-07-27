import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRolesToJsonb1782604447044 implements MigrationInterface {
    name = 'UpdateRolesToJsonb1782604447044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "entity_name"`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "roles"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "entity_name" character varying(100) NOT NULL`);
    }

}
