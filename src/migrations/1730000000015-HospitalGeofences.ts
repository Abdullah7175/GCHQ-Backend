import { MigrationInterface, QueryRunner } from 'typeorm';

export class HospitalGeofences1730000000015 implements MigrationInterface {
  name = 'HospitalGeofences1730000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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

    await queryRunner.query(`
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

    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD COLUMN IF NOT EXISTS "geofence_entered_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "geofence_entered_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hospital_geofence_points"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hospital_geofences"`);
  }
}
