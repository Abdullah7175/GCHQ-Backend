import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TriageCodesService } from './triage-codes.service';
import { CreateTriageCodeDto, UpdateTriageCodeDto } from './dto/triage-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('triage-codes')
@UseGuards(JwtAuthGuard)
export class TriageCodesController {
  constructor(private readonly service: TriageCodesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTriageCodeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTriageCodeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
