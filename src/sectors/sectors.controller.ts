import { Controller, Get, Post, Put, Delete, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { SectorsService } from './sectors.service';
import { CreateSectorDto, UpdateSectorDto } from './dto/sector.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sectors')
@UseGuards(JwtAuthGuard)
export class SectorsController {
  constructor(private readonly service: SectorsService) {}

  @Get()
  findAll(@Query('cityId') cityId?: string) {
    return this.service.findByCity(cityId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSectorDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSectorDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-override')
  toggleOverride(@Param('id') id: string) {
    return this.service.toggleOverride(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
