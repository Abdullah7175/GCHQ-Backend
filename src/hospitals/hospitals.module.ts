import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital } from './hospital.entity';
import { HospitalsService } from './hospitals.service';
import { HospitalsController } from './hospitals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hospital])],
  providers: [HospitalsService],
  controllers: [HospitalsController],
  exports: [HospitalsService],
})
export class HospitalsModule {}
