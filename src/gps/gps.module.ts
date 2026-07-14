import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GpsLocation } from './gps-location.entity';
import { GpsService } from './gps.service';
import { GpsController } from './gps.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GpsLocation])],
  providers: [GpsService],
  controllers: [GpsController],
  exports: [GpsService],
})
export class GpsModule {}
