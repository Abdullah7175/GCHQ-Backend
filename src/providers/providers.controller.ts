import { Controller, Get, Post, Put, Delete, Body, Param,
  Query, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('providers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProvidersController {
  constructor(private readonly service: ProvidersService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(undefined, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateProviderDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

