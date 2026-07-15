import { Controller, Get, Post, Put, Delete, Body, Param,
  Query, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('cities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CitiesController {
  constructor(private readonly service: CitiesService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(undefined, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Get('active')
  findActive() {
    return this.service.findAllActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateCityDto) {
    return this.service.createCity(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.service.updateCity(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

