import { MigrationInterface, QueryRunner } from 'typeorm';

export class LatencyBreachSystem1730000000012 implements MigrationInterface {
  name = 'LatencyBreachSystem1730000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD COLUMN IF NOT EXISTS "estimated_arrival_at" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "latency_breach_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "breach_type" varchar(40) NOT NULL,
        "city_id" uuid NOT NULL,
        "sector_id" uuid NULL,
        "target_role" varchar(40) NULL,
        "threshold_minutes" integer NOT NULL DEFAULT 6,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_latency_breach_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_latency_breach_rules_city"
          FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_latency_breach_rules_sector"
          FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "latency_breach_recipients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "rule_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "phone" varchar(20) NOT NULL,
        "channel" varchar(20) NOT NULL DEFAULT 'both',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_latency_breach_recipients" PRIMARY KEY ("id"),
        CONSTRAINT "FK_latency_breach_recipients_rule"
          FOREIGN KEY ("rule_id") REFERENCES "latency_breach_rules"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "latency_breach_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "rule_id" uuid NULL,
        "breach_type" varchar(40) NOT NULL,
        "city_id" uuid NOT NULL,
        "sector_id" uuid NULL,
        "reference_type" varchar(20) NOT NULL,
        "reference_id" uuid NOT NULL,
        "detected_at" TIMESTAMPTZ NOT NULL,
        "expected_at" TIMESTAMPTZ NULL,
        "actual_at" TIMESTAMPTZ NULL,
        "threshold_minutes" integer NOT NULL,
        "delay_minutes" numeric(8,2) NOT NULL,
        "metadata" jsonb NULL,
        CONSTRAINT "PK_latency_breach_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_latency_breach_records_rule"
          FOREIGN KEY ("rule_id") REFERENCES "latency_breach_rules"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_latency_breach_records_city"
          FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_latency_breach_records_sector"
          FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "latency_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "breach_record_id" uuid NOT NULL,
        "recipient_id" uuid NULL,
        "name" varchar NOT NULL,
        "phone" varchar(20) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "provider_response" text NULL,
        "sent_at" TIMESTAMPTZ NULL,
        CONSTRAINT "PK_latency_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_latency_notifications_breach"
          FOREIGN KEY ("breach_record_id") REFERENCES "latency_breach_records"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_latency_notifications_recipient"
          FOREIGN KEY ("recipient_id") REFERENCES "latency_breach_recipients"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_presence" (
        "user_id" uuid NOT NULL,
        "last_heartbeat_at" TIMESTAMPTZ NOT NULL,
        "last_login_at" TIMESTAMPTZ NULL,
        "disconnect_detected_at" TIMESTAMPTZ NULL,
        "open_breach_record_id" uuid NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_presence" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_user_presence_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_latency_breach_records_detected"
      ON "latency_breach_records" ("detected_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_latency_breach_records_reference"
      ON "latency_breach_records" ("reference_type", "reference_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_presence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "latency_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "latency_breach_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "latency_breach_recipients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "latency_breach_rules"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "estimated_arrival_at"`);
  }
}
