import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessagingAuthFieldName1730000000014 implements MigrationInterface {
  name = 'MessagingAuthFieldName1730000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messaging_provider_configs"
        ADD COLUMN IF NOT EXISTS "auth_field_name" varchar(40) NOT NULL DEFAULT 'token'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messaging_provider_configs" DROP COLUMN IF EXISTS "auth_field_name"
    `);
  }
}
