import { MigrationInterface, QueryRunner } from 'typeorm';

export class DriverShiftsAndAuditLogs1730000000009
  implements MigrationInterface
{
  name = 'DriverShiftsAndAuditLogs1730000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ambulance_drivers" (
        "ambulance_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_ambulance_drivers" PRIMARY KEY ("ambulance_id", "user_id"),
        CONSTRAINT "UQ_ambulance_drivers_user" UNIQUE ("user_id"),
        CONSTRAINT "FK_ambulance_drivers_ambulance"
          FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ambulance_drivers_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      INSERT INTO "ambulance_drivers" ("ambulance_id", "user_id")
      SELECT "id", "driver_id"
      FROM "ambulances"
      WHERE "driver_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ambulance_drivers_user"
      ON "ambulance_drivers" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NULL,
        "user_email" varchar(254) NULL,
        "user_role" varchar(40) NULL,
        "action" varchar(160) NOT NULL,
        "method" varchar(10) NULL,
        "path" varchar(500) NULL,
        "status_code" integer NULL,
        "success" boolean NOT NULL DEFAULT true,
        "duration_ms" integer NULL,
        "ip_address" varchar(64) NULL,
        "user_agent" text NULL,
        "latitude" numeric(10,7) NULL,
        "longitude" numeric(10,7) NULL,
        "metadata" jsonb NULL,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_created"
      ON "audit_logs" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_created"
      ON "audit_logs" ("action", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created"
      ON "audit_logs" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ambulance_drivers"`);
  }
}
