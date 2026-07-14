import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('hospitals')
@UseGuards(JwtAuthGuard)
export class HospitalsController {
  constructor(private readonly service: HospitalsService) {}

  @Get()
  findAll(@Query('cityId') cityId?: string) {
    return this.service.findByCity(cityId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHospitalDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
