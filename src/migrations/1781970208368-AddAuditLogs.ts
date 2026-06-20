import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogs1781970208368 implements MigrationInterface {
    name = 'AddAuditLogs1781970208368'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "action" character varying(50) NOT NULL, "entity_name" character varying(100) NOT NULL, "entity_id" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
