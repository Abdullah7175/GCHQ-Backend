import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow completed/cancelled cases to survive when an ambulance or hospital
 * is deleted — FK becomes NULL instead of cascading the whole history away.
 */
export class PreserveCompletedTransitHistory1730000000008 implements MigrationInterface {
  name = 'PreserveCompletedTransitHistory1730000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transits"
        ALTER COLUMN "ambulance_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transits"
        ALTER COLUMN "hospital_id" DROP NOT NULL
    `);

    // Drop old FKs if present and recreate as ON DELETE SET NULL
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'transits'::regclass
            AND contype = 'f'
            AND (
              pg_get_constraintdef(oid) ILIKE '%ambulance_id%'
              OR pg_get_constraintdef(oid) ILIKE '%hospital_id%'
            )
        LOOP
          EXECUTE format('ALTER TABLE transits DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD CONSTRAINT "FK_transits_ambulance"
        FOREIGN KEY ("ambulance_id") REFERENCES "ambulances"("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD CONSTRAINT "FK_transits_hospital"
        FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id")
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transits" DROP CONSTRAINT IF EXISTS "FK_transits_ambulance"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP CONSTRAINT IF EXISTS "FK_transits_hospital"`);
    await queryRunner.query(`
      UPDATE "transits" SET "ambulance_id" = (
        SELECT id FROM ambulances LIMIT 1
      ) WHERE "ambulance_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "transits" SET "hospital_id" = (
        SELECT id FROM hospitals LIMIT 1
      ) WHERE "hospital_id" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "transits" ALTER COLUMN "ambulance_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transits" ALTER COLUMN "hospital_id" SET NOT NULL`);
  }
}
