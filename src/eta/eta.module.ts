import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EtaSnapshot } from './eta-snapshot.entity';
import { EtaCorrectionFactor } from './eta-correction-factor.entity';
import { RouteEtaService } from './route-eta.service';
import { OsrmRoutingService } from './osrm-routing.service';
import { EtaCalibrationService } from './eta-calibration.service';
import { Transit } from '../transits/transit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EtaSnapshot, EtaCorrectionFactor, Transit])],
  providers: [RouteEtaService, OsrmRoutingService, EtaCalibrationService],
  exports: [RouteEtaService, OsrmRoutingService, EtaCalibrationService],
})
export class EtaModule {}
