import { Controller, Get, Post, Put, Delete, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AmbulancesService } from './ambulances.service';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateGpsDto } from './dto/ambulance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('ambulances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AmbulancesController {
  constructor(private readonly service: AmbulancesService) {}

  @Get()
  findAll(@Query('cityId') cityId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findByCity(cityId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Get('available')
  findAvailable(@Query('cityId') cityId?: string) {
    return this.service.findAvailable(cityId);
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

  @Patch(':id/gps')
  @RequirePermissions(Permission.UPDATE_GPS)
  updateGps(@Param('id') id: string, @Body() dto: UpdateGpsDto) {
    return this.service.updateGps(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

