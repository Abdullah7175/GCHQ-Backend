import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderShapes1730000000003 implements MigrationInterface {
  name = 'AddProviderShapes1730000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "provider_shape_enum" ADD VALUE IF NOT EXISTS 'star'`);
    await queryRunner.query(`ALTER TYPE "provider_shape_enum" ADD VALUE IF NOT EXISTS 'hexagon'`);
    await queryRunner.query(`ALTER TYPE "provider_shape_enum" ADD VALUE IF NOT EXISTS 'cross'`);
    await queryRunner.query(`ALTER TYPE "provider_shape_enum" ADD VALUE IF NOT EXISTS 'pentagon'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing enum values safely.
  }
}
