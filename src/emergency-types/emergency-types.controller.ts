import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { EmergencyTypesService } from './emergency-types.service';
import { CreateEmergencyTypeDto, UpdateEmergencyTypeDto } from './dto/emergency-type.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('emergency-types')
@UseGuards(JwtAuthGuard)
export class EmergencyTypesController {
  constructor(private readonly service: EmergencyTypesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmergencyTypeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmergencyTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
