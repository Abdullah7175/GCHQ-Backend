import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Join table linking hospitals to the emergency categories they can cater
 * (burn, cardiac, trauma…). One hospital can have many categories.
 */
export class HospitalEmergencyCategories1730000000006 implements MigrationInterface {
  name = 'HospitalEmergencyCategories1730000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hospital_emergency_types" (
        "hospital_id" uuid NOT NULL,
        "emergency_type_id" uuid NOT NULL,
        CONSTRAINT "PK_hospital_emergency_types" PRIMARY KEY ("hospital_id", "emergency_type_id"),
        CONSTRAINT "FK_het_hospital" FOREIGN KEY ("hospital_id")
          REFERENCES "hospitals" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_het_emergency_type" FOREIGN KEY ("emergency_type_id")
          REFERENCES "emergency_types" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_het_hospital" ON "hospital_emergency_types" ("hospital_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_het_emergency_type" ON "hospital_emergency_types" ("emergency_type_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hospital_emergency_types"`);
  }
}
