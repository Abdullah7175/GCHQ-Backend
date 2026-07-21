import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveRouteEta1730000000018 implements MigrationInterface {
  name = 'LiveRouteEta1730000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD COLUMN IF NOT EXISTS "route_geometry" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD COLUMN IF NOT EXISTS "route_distance_meters" integer NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD COLUMN IF NOT EXISTS "static_duration_seconds" integer NULL
    `);

    await queryRunner.query(`
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

    await queryRunner.query(`
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eta_snapshots_transit_predicted"
      ON "eta_snapshots" ("transit_id", "predicted_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eta_correction_city"
      ON "eta_correction_factors" ("city_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transits_status_ambulance"
      ON "transits" ("status", "ambulance_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transits_city_status_started"
      ON "transits" ("city_id", "status", "started_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gps_locations_ambulance_recorded"
      ON "gps_locations" ("ambulance_id", "recorded_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gps_locations_transit_recorded"
      ON "gps_locations" ("transit_id", "recorded_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gps_locations_transit_recorded"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gps_locations_ambulance_recorded"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_city_status_started"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_status_ambulance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eta_correction_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eta_snapshots_transit_predicted"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "eta_correction_factors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "eta_snapshots"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "static_duration_seconds"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "route_distance_meters"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "route_geometry"`);
  }
}
