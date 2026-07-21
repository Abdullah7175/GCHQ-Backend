import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital } from './hospital.entity';
import { EmergencyType } from '../emergency-types/emergency-type.entity';
import { HospitalsService } from './hospitals.service';
import { HospitalsController } from './hospitals.controller';
import { GeofencesModule } from '../geofences/geofences.module';

@Module({
  imports: [TypeOrmModule.forFeature([Hospital, EmergencyType]), GeofencesModule],
  providers: [HospitalsService],
  controllers: [HospitalsController],
  exports: [HospitalsService],
})
export class HospitalsModule {}
