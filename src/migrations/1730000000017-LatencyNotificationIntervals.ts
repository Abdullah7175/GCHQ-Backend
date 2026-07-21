import { MigrationInterface, QueryRunner } from 'typeorm';

export class LatencyNotificationIntervals1730000000017 implements MigrationInterface {
  name = 'LatencyNotificationIntervals1730000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "latency_breach_recipients"
        ADD COLUMN IF NOT EXISTS "notification_count" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "latency_breach_recipients"
        ADD COLUMN IF NOT EXISTS "notification_interval_minutes" integer NOT NULL DEFAULT 15
    `);
    await queryRunner.query(`
      ALTER TABLE "latency_notifications"
        ADD COLUMN IF NOT EXISTS "attempt_number" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "latency_notifications"
        ADD COLUMN IF NOT EXISTS "max_attempts" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "latency_notifications"
        ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_latency_notifications_pending_due"
      ON "latency_notifications" ("status", "scheduled_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_latency_notifications_pending_due"`);
    await queryRunner.query(`ALTER TABLE "latency_notifications" DROP COLUMN IF EXISTS "scheduled_at"`);
    await queryRunner.query(`ALTER TABLE "latency_notifications" DROP COLUMN IF EXISTS "max_attempts"`);
    await queryRunner.query(`ALTER TABLE "latency_notifications" DROP COLUMN IF EXISTS "attempt_number"`);
    await queryRunner.query(
      `ALTER TABLE "latency_breach_recipients" DROP COLUMN IF EXISTS "notification_interval_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "latency_breach_recipients" DROP COLUMN IF EXISTS "notification_count"`,
    );
  }
}
