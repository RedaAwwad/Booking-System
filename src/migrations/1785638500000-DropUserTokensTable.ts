import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserTokensTable1785638500000 implements MigrationInterface {
  name = 'DropUserTokensTable1785638500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_tokens" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "token" text NOT NULL,
        "tokenType" character varying(20) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_tokens_token" UNIQUE ("token"),
        CONSTRAINT "PK_user_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }
}
