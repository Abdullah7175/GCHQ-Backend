import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPermittedSectors1730000000011 implements MigrationInterface {
  name = 'UserPermittedSectors1730000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "permitted_sector_ids" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "permitted_sector_ids"
    `);
  }
}
