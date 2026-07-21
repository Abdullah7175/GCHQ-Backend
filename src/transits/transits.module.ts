import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transit } from './transit.entity';
import { TransitsService } from './transits.service';
import { TransitsController } from './transits.controller';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { City } from '../cities/city.entity';
import { EventsModule } from '../events/events.module';
import { LatencyModule } from '../latency/latency.module';

import { GeofencesModule } from '../geofences/geofences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transit, Ambulance, Hospital, City]),
    forwardRef(() => EventsModule),
    LatencyModule,
    GeofencesModule,
  ],
  providers: [TransitsService],
  controllers: [TransitsController],
  exports: [TransitsService],
})
export class TransitsModule {}
