import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { GpsService } from './gps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('gps')
@UseGuards(JwtAuthGuard)
export class GpsController {
  constructor(private readonly service: GpsService) {}

  @Get('ambulance/:ambulanceId')
  findByAmbulance(@Param('ambulanceId') ambulanceId: string, @Query('limit') limit?: string) {
    return this.service.findByAmbulance(ambulanceId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('transit/:transitId')
  findByTransit(@Param('transitId') transitId: string) {
    return this.service.findByTransit(transitId);
  }
}
