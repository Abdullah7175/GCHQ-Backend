import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import {
  CreateHospitalDto,
  SuitableHospitalsQueryDto,
  UpdateHospitalDto,
} from './dto/hospital.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HospitalsController {
  constructor(private readonly service: HospitalsService) {}

  @Get()
  findAll(@Query('cityId') cityId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findByCity(cityId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  /** Driver app: eligible hospitals, nearest/recommended first. */
  @Get('suitable')
  findSuitable(@Query() query: SuitableHospitalsQueryDto) {
    return this.service.findSuitable(
      query.cityId,
      query.emergencyTypeId,
      query.latitude,
      query.longitude,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateHospitalDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

