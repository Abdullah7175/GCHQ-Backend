import { Controller, Get, Post, Put, Delete, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { SectorsService } from './sectors.service';
import { CreateSectorDto, UpdateSectorDto } from './dto/sector.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('sectors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SectorsController {
  constructor(private readonly service: SectorsService) {}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateSectorDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateSectorDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-override')
  @RequirePermissions(Permission.TOGGLE_OVERRIDE)
  toggleOverride(@Param('id') id: string) {
    return this.service.toggleOverride(id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

