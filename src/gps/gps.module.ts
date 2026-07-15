import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GpsLocation } from './gps-location.entity';
import { GpsService } from './gps.service';
import { GpsController } from './gps.controller';
import { GpsCacheService } from './gps-cache.service';
import { TransitsModule } from '../transits/transits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GpsLocation]),
    forwardRef(() => TransitsModule),
  ],
  providers: [GpsService, GpsCacheService],
  controllers: [GpsController],
  exports: [GpsService, GpsCacheService, TypeOrmModule],
})
export class GpsModule {}

