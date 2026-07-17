import { MigrationInterface, QueryRunner } from 'typeorm';

/** OWASP login lockout + JWT revocation columns on users */
export class UserSecurityHardening1730000000007 implements MigrationInterface {
  name = 'UserSecurityHardening1730000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_login_attempts"`);
  }
}
