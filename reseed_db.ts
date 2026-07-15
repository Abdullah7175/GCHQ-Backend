const { Client } = require('pg');
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://root:%2A%2A%40%2F%23Abc1@103.65.248.160:5432/GCHQ?sslmode=disable' });
  await client.connect();
  
  console.log('Dropping schema public cascade...');
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.end();
  
  console.log('Schema recreated. Starting Nest App to trigger TypeORM sync and seed...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('Database synced and seeded successfully!');
  await app.close();
}

bootstrap().catch(console.error);
