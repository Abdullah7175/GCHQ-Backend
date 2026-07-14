import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cities')
@UseGuards(JwtAuthGuard)
export class CitiesController {
  constructor(private readonly service: CitiesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
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
  create(@Body() dto: CreateCityDto) {
    return this.service.createCity(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.service.updateCity(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
