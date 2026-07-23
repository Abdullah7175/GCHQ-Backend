import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransitAmbulanceStartedIndex1730000000020 implements MigrationInterface {
  name = 'TransitAmbulanceStartedIndex1730000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transits_ambulance_started"
      ON "transits" ("ambulance_id", "started_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transits_ambulance_started"`);
  }
}
