import { Controller, Get, Post, Put, Delete, Body, Param, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { AmbulancesService } from './ambulances.service';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateGpsDto } from './dto/ambulance.dto';
import { TransitHistoryQueryDto } from './dto/transit-history-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('ambulances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AmbulancesController {
  constructor(private readonly service: AmbulancesService) {}

  @Get()
  findAll(
    @Query('cityId') cityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.service.findByCity(
      cityId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      q,
    );
  }

  @Get('available')
  findAvailable(@Query('cityId') cityId?: string) {
    return this.service.findAvailable(cityId);
  }

  /** Driver's assigned unit + latest GPS (for mobile map) */
  @Get('mine')
  @RequirePermissions(Permission.UPDATE_GPS)
  findMine(@Req() req: { user: JwtPayload }) {
    return this.service.findMine(req.user.sub);
  }

  /** Completed cases for this unit, optional date range (Admin Cases / history). */
  @Get(':id/transit-history')
  @RequirePermissions(Permission.READ_TRANSIT)
  transitHistory(@Param('id') id: string, @Query() query: TransitHistoryQueryDto) {
    return this.service.findTransitHistory(id, query.from, query.to);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateAmbulanceDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateAmbulanceDto) {
    return this.service.update(id, dto);
  }

  /**
   * Live location ping — mobile should call every 15 seconds while logged in.
   * Updates ambulances.current_lat / current_lng / current_speed and any active transit.
   */
  @Patch(':id/gps')
  @RequirePermissions(Permission.UPDATE_GPS)
  updateGps(
    @Param('id') id: string,
    @Body() dto: UpdateGpsDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.updateGps(id, dto, dto.transitId, req.user.sub);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
