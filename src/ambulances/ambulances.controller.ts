import { Controller, Get, Post, Put, Delete, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AmbulancesService } from './ambulances.service';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateGpsDto } from './dto/ambulance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ambulances')
@UseGuards(JwtAuthGuard)
export class AmbulancesController {
  constructor(private readonly service: AmbulancesService) {}

  @Get()
  findAll(@Query('cityId') cityId?: string) {
    return this.service.findByCity(cityId);
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
  create(@Body() dto: CreateAmbulanceDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAmbulanceDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/gps')
  updateGps(@Param('id') id: string, @Body() dto: UpdateGpsDto) {
    return this.service.updateGps(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
