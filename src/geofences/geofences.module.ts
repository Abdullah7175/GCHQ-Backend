import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HospitalGeofence } from './hospital-geofence.entity';
import { HospitalGeofencePoint } from './hospital-geofence-point.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { HospitalGeofencesService } from './hospital-geofences.service';

@Module({
  imports: [TypeOrmModule.forFeature([HospitalGeofence, HospitalGeofencePoint, Hospital])],
  providers: [HospitalGeofencesService],
  exports: [HospitalGeofencesService],
})
export class GeofencesModule {}
