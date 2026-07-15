import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/users/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepository = app.get(getRepositoryToken(User));

  const md5Hash = crypto.createHash('md5').update('password123').digest('hex');
  const password = await bcrypt.hash(md5Hash, 10);

  await userRepository.createQueryBuilder()
    .update(User)
    .set({ password })
    .execute();

  console.log('Successfully updated all passwords to md5->bcrypt hash');
  await app.close();
}

bootstrap().catch(console.error);
