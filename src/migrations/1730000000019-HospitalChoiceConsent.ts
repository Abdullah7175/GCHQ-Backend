import { MigrationInterface, QueryRunner } from 'typeorm';

export class HospitalChoiceConsent1730000000019 implements MigrationInterface {
  name = 'HospitalChoiceConsent1730000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transits"
        ADD COLUMN IF NOT EXISTS "hospital_choice_consent" varchar(10) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transits_hospital_choice_consent"
      ON "transits" ("hospital_choice_consent")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_hospital_choice_consent"`);
    await queryRunner.query(`
      ALTER TABLE "transits" DROP COLUMN IF EXISTS "hospital_choice_consent"
    `);
  }
}
