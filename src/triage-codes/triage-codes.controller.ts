import { Controller, Get, Post, Put, Delete, Body, Param,
  Query, UseGuards } from '@nestjs/common';
import { TriageCodesService } from './triage-codes.service';
import { CreateTriageCodeDto, UpdateTriageCodeDto } from './dto/triage-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('triage-codes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TriageCodesController {
  constructor(private readonly service: TriageCodesService) {}

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
  create(@Body() dto: CreateTriageCodeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateTriageCodeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

