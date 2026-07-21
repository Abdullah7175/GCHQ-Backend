import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderMarkerLetter1730000000010 implements MigrationInterface {
  name = 'ProviderMarkerLetter1730000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "providers"
        ADD COLUMN IF NOT EXISTS "marker_letter" varchar(3) NOT NULL DEFAULT '?'
    `);
    await queryRunner.query(`
      UPDATE "providers"
      SET "marker_letter" = UPPER(LEFT(REGEXP_REPLACE("name", '[^a-zA-Z]', '', 'g'), 1))
      WHERE "marker_letter" = '?' OR "marker_letter" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "providers" DROP COLUMN IF EXISTS "marker_letter"`);
  }
}
