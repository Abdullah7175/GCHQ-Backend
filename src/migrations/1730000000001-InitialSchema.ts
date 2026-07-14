import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730000000001 implements MigrationInterface {
  name = 'InitialSchema1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('hospital', 'safe_city', 'hq_1122', 'vvip', 'paramedic', 'admin');
      CREATE TYPE "provider_shape_enum" AS ENUM ('circle', 'triangle', 'square', 'diamond');
      CREATE TYPE "ambulance_status_enum" AS ENUM ('available', 'en_route', 'busy', 'offline');
      CREATE TYPE "transit_status_enum" AS ENUM ('pending', 'en_route', 'arrived', 'completed', 'cancelled');
      CREATE TYPE "prep_status_enum" AS ENUM ('pending', 'ready');
      CREATE TYPE "sector_grid_status_enum" AS ENUM ('flowing', 'moderate', 'saturating', 'gridlocked');
    `);

    await queryRunner.query(`
      CREATE TABLE "providers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "shape" "provider_shape_enum" NOT NULL DEFAULT 'circle',
        "color" character varying NOT NULL DEFAULT '#d93343',
        "description" character varying,
        CONSTRAINT "UQ_providers_name" UNIQUE ("name"),
        CONSTRAINT "UQ_providers_code" UNIQUE ("code"),
        CONSTRAINT "PK_providers" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "sectors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "color" character varying NOT NULL DEFAULT '#0056b3',
        "grid_status" "sector_grid_status_enum" NOT NULL DEFAULT 'flowing',
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "override_active" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_sectors_name" UNIQUE ("name"),
        CONSTRAINT "UQ_sectors_code" UNIQUE ("code"),
        CONSTRAINT "PK_sectors" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "hospitals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "address" character varying,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "sector_id" uuid,
        "bed_capacity" integer NOT NULL DEFAULT 0,
        "er_bays" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_hospitals_name" UNIQUE ("name"),
        CONSTRAINT "PK_hospitals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hospitals_sector" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "emergency_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "description" character varying,
        "severity_level" integer NOT NULL DEFAULT 1,
        CONSTRAINT "UQ_emergency_types_name" UNIQUE ("name"),
        CONSTRAINT "UQ_emergency_types_code" UNIQUE ("code"),
        CONSTRAINT "PK_emergency_types" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "triage_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "color" character varying NOT NULL DEFAULT '#ba1a1a',
        "priority" integer NOT NULL DEFAULT 1,
        "description" character varying,
        CONSTRAINT "UQ_triage_codes_name" UNIQUE ("name"),
        CONSTRAINT "UQ_triage_codes_code" UNIQUE ("code"),
        CONSTRAINT "PK_triage_codes" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "name" character varying NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'hospital',
        "hospital_id" uuid,
        "provider_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_hospital" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_users_provider" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ambulances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "unit_number" character varying NOT NULL,
        "provider_id" uuid NOT NULL,
        "status" "ambulance_status_enum" NOT NULL DEFAULT 'available',
        "current_lat" numeric(10,7),
        "current_lng" numeric(10,7),
        "current_speed" numeric(6,2) NOT NULL DEFAULT 0,
        "driver_id" uuid,
        CONSTRAINT "UQ_ambulances_unit_number" UNIQUE ("unit_number"),
        CONSTRAINT "PK_ambulances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ambulances_provider" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ambulances_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "transits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "transit_id" character varying NOT NULL,
        "ambulance_id" uuid NOT NULL,
        "hospital_id" uuid NOT NULL,
        "emergency_type_id" uuid NOT NULL,
        "triage_code_id" uuid NOT NULL,
        "sector_id" uuid,
        "status" "transit_status_enum" NOT NULL DEFAULT 'pending',
        "prep_status" "prep_status_enum" NOT NULL DEFAULT 'pending',
        "paramedic_notes" text,
        "eta_minutes" numeric(6,2),
        "origin_lat" numeric(10,7),
        "origin_lng" numeric(10,7),
        "current_lat" numeric(10,7),
        "current_lng" numeric(10,7),
        "current_speed" numeric(6,2) NOT NULL DEFAULT 0,
        "started_at" TIMESTAMPTZ,
        "arrived_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "baseline_eta_minutes" numeric(6,2),
        CONSTRAINT "UQ_transits_transit_id" UNIQUE ("transit_id"),
        CONSTRAINT "PK_transits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transits_ambulance" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transits_hospital" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transits_emergency_type" FOREIGN KEY ("emergency_type_id") REFERENCES "emergency_types"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transits_triage_code" FOREIGN KEY ("triage_code_id") REFERENCES "triage_codes"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transits_sector" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "gps_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "ambulance_id" uuid NOT NULL,
        "transit_id" uuid,
        "latitude" numeric(10,7) NOT NULL,
        "longitude" numeric(10,7) NOT NULL,
        "speed" numeric(6,2) NOT NULL DEFAULT 0,
        "heading" numeric(6,2),
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gps_locations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gps_ambulance" FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gps_transit" FOREIGN KEY ("transit_id") REFERENCES "transits"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transits_status" ON "transits" ("status");`);
    await queryRunner.query(`CREATE INDEX "IDX_transits_hospital" ON "transits" ("hospital_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_transits_created" ON "transits" ("created_at");`);
    await queryRunner.query(`CREATE INDEX "IDX_gps_ambulance" ON "gps_locations" ("ambulance_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_gps_recorded" ON "gps_locations" ("recorded_at");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gps_locations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ambulances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "triage_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "emergency_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hospitals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sectors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "providers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sector_grid_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "prep_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transit_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ambulance_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "provider_shape_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
