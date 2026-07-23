import { Controller, Get, Post, Put, Delete, Body, Param,
  Query, UseGuards } from '@nestjs/common';
import { EmergencyTypesService } from './emergency-types.service';
import { CreateEmergencyTypeDto, UpdateEmergencyTypeDto } from './dto/emergency-type.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('emergency-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmergencyTypesController {
  constructor(private readonly service: EmergencyTypesService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    return this.service.search(
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
  create(@Body() dto: CreateEmergencyTypeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateEmergencyTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

