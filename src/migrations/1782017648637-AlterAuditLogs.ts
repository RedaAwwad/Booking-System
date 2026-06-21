import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAuditLogs1782017648637 implements MigrationInterface {
  name = 'AlterAuditLogs1782017648637';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old minimal columns
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "user_id"`);

    // Add new columns
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN "correlation_id"  VARCHAR(36)  NOT NULL DEFAULT '',
        ADD COLUMN "event_type"      VARCHAR(100) NOT NULL DEFAULT '',
        ADD COLUMN "entity_type"     VARCHAR(100) NOT NULL DEFAULT '',
        ADD COLUMN "performed_by"    VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN "old_value"       JSONB,
        ADD COLUMN "new_value"       JSONB,
        ADD COLUMN "metadata"        JSONB,
        ADD COLUMN "event_timestamp" TIMESTAMP    NOT NULL DEFAULT now()
    `);

    // Remove the temporary defaults now that columns exist
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "correlation_id"  DROP DEFAULT,
        ALTER COLUMN "event_type"      DROP DEFAULT,
        ALTER COLUMN "entity_type"     DROP DEFAULT,
        ALTER COLUMN "performed_by"    DROP DEFAULT,
        ALTER COLUMN "event_timestamp" DROP DEFAULT
    `);

    // Unique constraint for idempotent consumer deduplication
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "UQ_audit_logs_correlation_id" UNIQUE ("correlation_id")
    `);

    // Rename entity_name → entity_type is already handled by the new column above;
    // keep entity_name as it was but rename it to entity_id usage (already nullable varchar)
    // entity_name column already exists from the previous migration — no action needed.

    // Performance indexes
    await queryRunner.query(`
      CREATE INDEX "idx_audit_entity"  ON "audit_logs" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_created" ON "audit_logs" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_audit_created"`);
    await queryRunner.query(`DROP INDEX "idx_audit_entity"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP CONSTRAINT "UQ_audit_logs_correlation_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN "event_timestamp",
        DROP COLUMN "metadata",
        DROP COLUMN "new_value",
        DROP COLUMN "old_value",
        DROP COLUMN "performed_by",
        DROP COLUMN "entity_type",
        DROP COLUMN "event_type",
        DROP COLUMN "correlation_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN "user_id" UUID NOT NULL DEFAULT uuid_generate_v4()`,
    );
  }
}
