import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorridorWorkflow1730000000004 implements MigrationInterface {
  name = 'CorridorWorkflow1730000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "sector_id" uuid,
      ADD COLUMN IF NOT EXISTS "is_city_overseer" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users"
        ADD CONSTRAINT "FK_users_sector"
        FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "transits"
      ADD COLUMN IF NOT EXISTS "claimed_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "claimed_at" timestamptz
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transits"
        ADD CONSTRAINT "FK_transits_claimed_by"
        FOREIGN KEY ("claimed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transits" DROP CONSTRAINT IF EXISTS "FK_transits_claimed_by"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "claimed_at"`);
    await queryRunner.query(`ALTER TABLE "transits" DROP COLUMN IF EXISTS "claimed_by_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_sector"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_city_overseer"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "sector_id"`);
  }
}
