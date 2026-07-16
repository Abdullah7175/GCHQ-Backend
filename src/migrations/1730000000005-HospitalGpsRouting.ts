import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop unused hospital bed/ER fields and ensure destination GPS is populated
 * for driver routing (shortest path to hospital).
 */
export class HospitalGpsRouting1730000000005 implements MigrationInterface {
  name = 'HospitalGpsRouting1730000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "bed_capacity"`);
    await queryRunner.query(`ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "er_bays"`);

    // Known Lahore / Islamabad ER coordinates (WGS84)
    await queryRunner.query(`
      UPDATE "hospitals" SET
        "latitude" = CASE
          WHEN "name" ILIKE '%Mayo%' THEN 31.5704500
          WHEN "name" ILIKE '%Jinnah%' THEN 31.4847200
          WHEN "name" ILIKE '%Services%' THEN 31.5389100
          WHEN "name" ILIKE '%General%' THEN 31.4912500
          WHEN "name" ILIKE '%Shifa%' THEN 33.6630500
          WHEN "name" ILIKE '%PIMS%' THEN 33.6951200
          ELSE "latitude"
        END,
        "longitude" = CASE
          WHEN "name" ILIKE '%Mayo%' THEN 74.3089200
          WHEN "name" ILIKE '%Jinnah%' THEN 74.3015800
          WHEN "name" ILIKE '%Services%' THEN 74.3336400
          WHEN "name" ILIKE '%General%' THEN 74.3168800
          WHEN "name" ILIKE '%Shifa%' THEN 73.0652100
          WHEN "name" ILIKE '%PIMS%' THEN 73.0550400
          ELSE "longitude"
        END
      WHERE "name" ILIKE ANY (ARRAY['%Mayo%','%Jinnah%','%Services%','%General%','%Shifa%','%PIMS%'])
    `);

    // Any hospital still missing coords → Lahore center fallback (admin can fix)
    await queryRunner.query(`
      UPDATE "hospitals"
      SET "latitude" = 31.5497000, "longitude" = 74.3436000
      WHERE "latitude" IS NULL OR "longitude" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hospitals" ADD COLUMN IF NOT EXISTS "bed_capacity" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "hospitals" ADD COLUMN IF NOT EXISTS "er_bays" integer NOT NULL DEFAULT 0`);
  }
}
