import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeofenceShapeType1730000000016 implements MigrationInterface {
  name = 'GeofenceShapeType1730000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hospital_geofences"
        ADD COLUMN IF NOT EXISTS "shape_type" varchar(20) NOT NULL DEFAULT 'circle'
    `);
    await queryRunner.query(`
      ALTER TABLE "hospital_geofences"
        ALTER COLUMN "radius_meters" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hospital_geofences" DROP COLUMN IF EXISTS "shape_type"
    `);
  }
}
