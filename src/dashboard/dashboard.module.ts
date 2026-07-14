import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transit } from '../transits/transit.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Sector } from '../sectors/sector.entity';
import { City } from '../cities/city.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transit, Ambulance, Sector, City]),
    UsersModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
