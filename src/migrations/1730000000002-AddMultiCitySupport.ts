import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_CITY_CONFIG } from '../cities/city-operational-config';

export class AddMultiCitySupport1730000000002 implements MigrationInterface {
  name = 'AddMultiCitySupport1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultConfig = JSON.stringify(DEFAULT_CITY_CONFIG).replace(/'/g, "''");

    await queryRunner.query(`
      CREATE TABLE "cities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "province" character varying,
        "country" character varying NOT NULL DEFAULT 'Pakistan',
        "timezone" character varying NOT NULL DEFAULT 'Asia/Karachi',
        "is_active" boolean NOT NULL DEFAULT true,
        "operational_config" jsonb NOT NULL DEFAULT '${defaultConfig}'::jsonb,
        CONSTRAINT "UQ_cities_code" UNIQUE ("code"),
        CONSTRAINT "PK_cities" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      INSERT INTO "cities" ("name", "code", "province", "operational_config")
      VALUES ('Lahore', 'LHE', 'Punjab', '${defaultConfig}'::jsonb)
      RETURNING "id";
    `);

    const lahore = await queryRunner.query(`SELECT id FROM cities WHERE code = 'LHE' LIMIT 1`);
    const lahoreId = lahore[0].id;

    await queryRunner.query(`ALTER TABLE "sectors" ADD COLUMN "city_id" uuid`);
    await queryRunner.query(`UPDATE "sectors" SET "city_id" = '${lahoreId}'`);
    await queryRunner.query(`ALTER TABLE "sectors" ALTER COLUMN "city_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "sectors" ADD CONSTRAINT "FK_sectors_city" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "UQ_sectors_code"`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "UQ_sectors_name"`);
    await queryRunner.query(`ALTER TABLE "sectors" ADD CONSTRAINT "UQ_sectors_code_city" UNIQUE ("code", "city_id")`);
    await queryRunner.query(`ALTER TABLE "sectors" ADD CONSTRAINT "UQ_sectors_name_city" UNIQUE ("name", "city_id")`);

    await queryRunner.query(`ALTER TABLE "hospitals" ADD COLUMN "city_id" uuid`);
    await queryRunner.query(`UPDATE "hospitals" SET "city_id" = '${lahoreId}'`);
    await queryRunner.query(`ALTER TABLE "hospitals" ALTER COLUMN "city_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "hospitals" ADD CONSTRAINT "FK_hospitals_city" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "hospitals" DROP CONSTRAINT IF EXISTS "UQ_hospitals_name"`);
    await queryRunner.query(`ALTER TABLE "hospitals" ADD CONSTRAINT "UQ_hospitals_name_city" UNIQUE ("name", "city_id")`);

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "city_id" uuid`);
    await queryRunner.query(`UPDATE "users" SET "city_id" = '${lahoreId}' WHERE role != 'admin'`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_city" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL`);

    await queryRunner.query(`ALTER TABLE "ambulances" ADD COLUMN "city_id" uuid`);
    await queryRunner.query(`UPDATE "ambulances" SET "city_id" = '${lahoreId}'`);
    await queryRunner.query(`ALTER TABLE "ambulances" ALTER COLUMN "city_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "ambulances" ADD CONSTRAINT "FK_ambulances_city" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "ambulances" DROP CONSTRAINT IF EXISTS "UQ_ambulances_unit_number"`);
    await queryRunner.query(`ALTER TABLE "ambulances" ADD CONSTRAINT "UQ_ambulances_unit_city" UNIQUE ("unit_number", "city_id")`);

    await queryRunner.query(`ALTER TABLE "transits" ADD COLUMN "city_id" uuid`);
    await queryRunner.query(`
      UPDATE "transits" t SET "city_id" = h."city_id"
      FROM "hospitals" h WHERE t."hospital_id" = h."id"
    `);
    await queryRunner.query(`UPDATE "transits" SET "city_id" = '${lahoreId}' WHERE "city_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "transits" ALTER COLUMN "city_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transits" ADD CONSTRAINT "FK_transits_city" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE`);

    await queryRunner.query(`CREATE INDEX "IDX_sectors_city" ON "sectors" ("city_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_hospitals_city" ON "hospitals" ("city_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_city" ON "users" ("city_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ambulances_city" ON "ambulances" ("city_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ambulances_city_status" ON "ambulances" ("city_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_transits_city" ON "transits" ("city_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transits_city_status" ON "transits" ("city_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_transits_city_created" ON "transits" ("city_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_cities_active" ON "cities" ("is_active")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cities_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_city_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_city_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ambulances_city_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ambulances_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hospitals_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sectors_city"`);

    await queryRunner.query(`ALTER TABLE "transits" DROP CONSTRAINT IF EXISTS "FK_transits_city"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN "city_id"`);

    await queryRunner.query(`ALTER TABLE "ambulances" DROP CONSTRAINT IF EXISTS "UQ_ambulances_unit_city"`);
    await queryRunner.query(`ALTER TABLE "ambulances" ADD CONSTRAINT "UQ_ambulances_unit_number" UNIQUE ("unit_number")`);
    await queryRunner.query(`ALTER TABLE "ambulances" DROP CONSTRAINT IF EXISTS "FK_ambulances_city"`);
    await queryRunner.query(`ALTER TABLE "ambulances" DROP COLUMN "city_id"`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_city"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city_id"`);

    await queryRunner.query(`ALTER TABLE "hospitals" DROP CONSTRAINT IF EXISTS "UQ_hospitals_name_city"`);
    await queryRunner.query(`ALTER TABLE "hospitals" ADD CONSTRAINT "UQ_hospitals_name" UNIQUE ("name")`);
    await queryRunner.query(`ALTER TABLE "hospitals" DROP CONSTRAINT IF EXISTS "FK_hospitals_city"`);
    await queryRunner.query(`ALTER TABLE "hospitals" DROP COLUMN "city_id"`);

    await queryRunner.query(`ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "UQ_sectors_name_city"`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "UQ_sectors_code_city"`);
    await queryRunner.query(`ALTER TABLE "sectors" ADD CONSTRAINT "UQ_sectors_code" UNIQUE ("code")`);
    await queryRunner.query(`ALTER TABLE "sectors" ADD CONSTRAINT "UQ_sectors_name" UNIQUE ("name")`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "FK_sectors_city"`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP COLUMN "city_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "cities"`);
  }
}
