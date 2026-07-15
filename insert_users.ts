import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/users/user.entity';
import { Hospital } from './src/hospitals/hospital.entity';
import { UserRole } from './src/common/enums';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepo = app.get(getRepositoryToken(User));
  const hospitalRepo = app.get(getRepositoryToken(Hospital));

  const md5Hash = crypto.createHash('md5').update('password123').digest('hex');
  const password = await bcrypt.hash(md5Hash, 10);

  const hospitals = await hospitalRepo.find();
  
  if (hospitals.length > 0) {
    const mayo = hospitals.find(h => h.name.includes('Mayo')) || hospitals[0];
    const jinnah = hospitals.find(h => h.name.includes('Jinnah')) || hospitals[0];

    const mayoUser = await userRepo.findOne({ where: { email: 'hospital@mayo.pk' } });
    if (!mayoUser) {
      await userRepo.save({
        email: 'hospital@mayo.pk',
        password,
        name: 'Mayo ER Lead',
        role: UserRole.HOSPITAL,
        cityId: mayo.cityId,
        hospitalId: mayo.id
      });
      console.log('Inserted hospital@mayo.pk');
    }

    const jinnahUser = await userRepo.findOne({ where: { email: 'hospital@jinnah.pk' } });
    if (!jinnahUser) {
      await userRepo.save({
        email: 'hospital@jinnah.pk',
        password,
        name: 'Jinnah ER Lead',
        role: UserRole.HOSPITAL,
        cityId: jinnah.cityId,
        hospitalId: jinnah.id
      });
      console.log('Inserted hospital@jinnah.pk');
    }
  }

  await app.close();
}

bootstrap().catch(console.error);
