import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ambulance } from './ambulance.entity';
import { AmbulancesService } from './ambulances.service';
import { AmbulancesController } from './ambulances.controller';
import { GpsLocation } from '../gps/gps-location.entity';
import { EventsModule } from '../events/events.module';
import { TransitsModule } from '../transits/transits.module';
import { GpsModule } from '../gps/gps.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ambulance, GpsLocation]),
    forwardRef(() => EventsModule),
    forwardRef(() => TransitsModule),
    forwardRef(() => GpsModule),
  ],
  providers: [AmbulancesService],
  controllers: [AmbulancesController],
  exports: [AmbulancesService],
})
export class AmbulancesModule {}

