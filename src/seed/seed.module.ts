import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../cities/city.entity';
import { Provider } from '../providers/provider.entity';
import { Sector } from '../sectors/sector.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { EmergencyType } from '../emergency-types/emergency-type.entity';
import { TriageCode } from '../triage-codes/triage-code.entity';
import { User } from '../users/user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      City,
      Provider,
      Sector,
      Hospital,
      EmergencyType,
      TriageCode,
      User,
      Ambulance,
      Transit,
    ]),
  ],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
