import { MigrationInterface, QueryRunner } from "typeorm";

export class SplitOutboxPerModule1782700013446 implements MigrationInterface {
    name = 'SplitOutboxPerModule1782700013446'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "flight_outbox_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payload" jsonb NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'READY', "failed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3df9cdd42b1a2d19f965aa610c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "hotel_outbox_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payload" jsonb NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'READY', "failed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c5e23f814267d125f2d0ec3105f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "entity_name"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "roles" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "roles"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "entity_name" character varying(100) NOT NULL`);
        await queryRunner.query(`DROP TABLE "hotel_outbox_messages"`);
        await queryRunner.query(`DROP TABLE "flight_outbox_messages"`);
    }

}
