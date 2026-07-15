import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/users/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepository = app.get(getRepositoryToken(User));

  const users = await userRepository.find();
  console.log(users.map(u => u.email));
  await app.close();
}

bootstrap().catch(console.error);
