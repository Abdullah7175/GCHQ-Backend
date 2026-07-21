import { DataSource } from 'typeorm';

/**
 * Idempotent schema backfill for databases created before migrations were tracked.
 * Safe to run on every API startup.
 */
export async function ensureDatabaseSchema(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0
  `);
  await dataSource.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ NULL
  `);
  await dataSource.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0
  `);

  const nullableCols: { column: string }[] = await dataSource.query(`
    SELECT column_name AS column
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transits'
      AND column_name IN ('ambulance_id', 'hospital_id')
      AND is_nullable = 'NO'
  `);
  for (const row of nullableCols) {
    await dataSource.query(
      `ALTER TABLE "transits" ALTER COLUMN "${row.column}" DROP NOT NULL`,
    );
  }

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "ambulance_drivers" (
      "ambulance_id" uuid NOT NULL,
      "user_id" uuid NOT NULL,
      CONSTRAINT "PK_ambulance_drivers" PRIMARY KEY ("ambulance_id", "user_id"),
      CONSTRAINT "FK_ambulance_drivers_ambulance"
        FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_ambulance_drivers_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    )
  `);
  await dataSource.query(`
    INSERT INTO "ambulance_drivers" ("ambulance_id", "user_id")
    SELECT "id", "driver_id"
    FROM "ambulances"
    WHERE "driver_id" IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await dataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ambulance_drivers_user"
    ON "ambulance_drivers" ("user_id")
  `);

  await dataSource.query(`
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
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_created"
    ON "audit_logs" ("user_id", "created_at")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_created"
    ON "audit_logs" ("action", "created_at")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created"
    ON "audit_logs" ("created_at" DESC)
  `);

  await dataSource.query(`
    ALTER TABLE "providers"
      ADD COLUMN IF NOT EXISTS "marker_letter" varchar(3) NOT NULL DEFAULT '?'
  `);
  await dataSource.query(`
    UPDATE "providers"
    SET "marker_letter" = UPPER(LEFT(REGEXP_REPLACE("name", '[^a-zA-Z]', '', 'g'), 1))
    WHERE "marker_letter" = '?' OR "marker_letter" = ''
  `);
  await dataSource.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "permitted_sector_ids" text NULL
  `);

  await dataSource.query(`
    ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "estimated_arrival_at" TIMESTAMPTZ NULL
  `);
  await dataSource.query(`
    ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "hospital_choice_consent" varchar(10) NULL
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_transits_hospital_choice_consent"
    ON "transits" ("hospital_choice_consent")
  `);

  await dataSource.query(`
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

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "latency_breach_recipients" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      "rule_id" uuid NOT NULL,
      "name" varchar NOT NULL,
      "phone" varchar(20) NOT NULL,
      "channel" varchar(20) NOT NULL DEFAULT 'both',
      "notification_count" integer NOT NULL DEFAULT 1,
      "notification_interval_minutes" integer NOT NULL DEFAULT 15,
      "is_active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_latency_breach_recipients" PRIMARY KEY ("id"),
      CONSTRAINT "FK_latency_breach_recipients_rule"
        FOREIGN KEY ("rule_id") REFERENCES "latency_breach_rules"("id") ON DELETE CASCADE
    )
  `);
  await dataSource.query(`
    ALTER TABLE "latency_breach_recipients"
      ADD COLUMN IF NOT EXISTS "notification_count" integer NOT NULL DEFAULT 1
  `);
  await dataSource.query(`
    ALTER TABLE "latency_breach_recipients"
      ADD COLUMN IF NOT EXISTS "notification_interval_minutes" integer NOT NULL DEFAULT 15
  `);

  await dataSource.query(`
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

  await dataSource.query(`
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
      "attempt_number" integer NOT NULL DEFAULT 1,
      "max_attempts" integer NOT NULL DEFAULT 1,
      "scheduled_at" TIMESTAMPTZ NULL,
      "provider_response" text NULL,
      "sent_at" TIMESTAMPTZ NULL,
      CONSTRAINT "PK_latency_notifications" PRIMARY KEY ("id"),
      CONSTRAINT "FK_latency_notifications_breach"
        FOREIGN KEY ("breach_record_id") REFERENCES "latency_breach_records"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_latency_notifications_recipient"
        FOREIGN KEY ("recipient_id") REFERENCES "latency_breach_recipients"("id") ON DELETE SET NULL
    )
  `);
  await dataSource.query(`
    ALTER TABLE "latency_notifications"
      ADD COLUMN IF NOT EXISTS "attempt_number" integer NOT NULL DEFAULT 1
  `);
  await dataSource.query(`
    ALTER TABLE "latency_notifications"
      ADD COLUMN IF NOT EXISTS "max_attempts" integer NOT NULL DEFAULT 1
  `);
  await dataSource.query(`
    ALTER TABLE "latency_notifications"
      ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ NULL
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_latency_notifications_pending_due"
    ON "latency_notifications" ("status", "scheduled_at")
  `);

  await dataSource.query(`
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

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_latency_breach_records_detected"
    ON "latency_breach_records" ("detected_at" DESC)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_latency_breach_records_reference"
    ON "latency_breach_records" ("reference_type", "reference_id")
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "messaging_provider_configs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      "name" varchar NOT NULL,
      "channel" varchar(20) NOT NULL,
      "api_url_cipher" text NOT NULL,
      "secret_key_cipher" text NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_messaging_provider_configs" PRIMARY KEY ("id")
    )
  `);
  await dataSource.query(`
    ALTER TABLE "messaging_provider_configs"
      ADD COLUMN IF NOT EXISTS "auth_field_name" varchar(40) NOT NULL DEFAULT 'token'
  `);

  // Keep at most one active provider per channel (SMS / WhatsApp are independent).
  await dataSource.query(`
    UPDATE "messaging_provider_configs" m
    SET "is_active" = false
    WHERE m."is_active" = true
      AND m."id" NOT IN (
        SELECT DISTINCT ON ("channel") "id"
        FROM "messaging_provider_configs"
        WHERE "is_active" = true
        ORDER BY "channel", "updated_at" DESC
      )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "hospital_geofences" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      "hospital_id" uuid NOT NULL,
      "center_lat" numeric(10,7) NOT NULL,
      "center_lng" numeric(10,7) NOT NULL,
      "radius_meters" integer NOT NULL,
      CONSTRAINT "PK_hospital_geofences" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_hospital_geofences_hospital" UNIQUE ("hospital_id"),
      CONSTRAINT "FK_hospital_geofences_hospital"
        FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "hospital_geofence_points" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      "geofence_id" uuid NOT NULL,
      "point_index" integer NOT NULL,
      "latitude" numeric(10,7) NOT NULL,
      "longitude" numeric(10,7) NOT NULL,
      CONSTRAINT "PK_hospital_geofence_points" PRIMARY KEY ("id"),
      CONSTRAINT "FK_hospital_geofence_points_geofence"
        FOREIGN KEY ("geofence_id") REFERENCES "hospital_geofences"("id") ON DELETE CASCADE
    )
  `);

  await dataSource.query(`
    ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "geofence_entered_at" TIMESTAMPTZ NULL
  `);

  await dataSource.query(`
    ALTER TABLE "hospital_geofences"
      ADD COLUMN IF NOT EXISTS "shape_type" varchar(20) NOT NULL DEFAULT 'circle'
  `);
  await dataSource.query(`
    ALTER TABLE "hospital_geofences"
      ALTER COLUMN "radius_meters" DROP NOT NULL
  `);

  // Live route ETA (OSRM geometry + telemetry-based ETA + self-calibration)
  await dataSource.query(`
    ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "route_geometry" jsonb NULL
  `);
  await dataSource.query(`
    ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "route_distance_meters" integer NULL
  `);
  await dataSource.query(`
    ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "static_duration_seconds" integer NULL
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "eta_snapshots" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "transit_id" uuid NOT NULL,
      "predicted_at" TIMESTAMPTZ NOT NULL,
      "eta_seconds" integer NOT NULL,
      "eta_timestamp" TIMESTAMPTZ NOT NULL,
      "remaining_distance_km" double precision NOT NULL,
      "rolling_avg_speed_kmh" double precision NOT NULL,
      "off_route_meters" double precision NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_eta_snapshots" PRIMARY KEY ("id"),
      CONSTRAINT "FK_eta_snapshots_transit"
        FOREIGN KEY ("transit_id") REFERENCES "transits"("id") ON DELETE CASCADE
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "eta_correction_factors" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "city_id" uuid NOT NULL,
      "hour_of_day" integer NOT NULL,
      "correction_factor" double precision NOT NULL,
      "sample_size" integer NOT NULL DEFAULT 0,
      "computed_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_eta_correction_factors" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_eta_correction_city_hour" UNIQUE ("city_id", "hour_of_day"),
      CONSTRAINT "FK_eta_correction_city"
        FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE
    )
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_eta_snapshots_transit_predicted"
    ON "eta_snapshots" ("transit_id", "predicted_at" DESC)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_eta_correction_city"
    ON "eta_correction_factors" ("city_id")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_transits_status_ambulance"
    ON "transits" ("status", "ambulance_id")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_transits_city_status_started"
    ON "transits" ("city_id", "status", "started_at" DESC)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_gps_locations_ambulance_recorded"
    ON "gps_locations" ("ambulance_id", "recorded_at" DESC)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_gps_locations_transit_recorded"
    ON "gps_locations" ("transit_id", "recorded_at" DESC)
  `);
}
