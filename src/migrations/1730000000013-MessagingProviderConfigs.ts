import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessagingProviderConfigs1730000000013 implements MigrationInterface {
  name = 'MessagingProviderConfigs1730000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messaging_provider_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "channel" varchar(20) NOT NULL,
        "api_url_cipher" text NOT NULL,
        "secret_key_cipher" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_messaging_provider_configs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messaging_provider_configs"`);
  }
}
