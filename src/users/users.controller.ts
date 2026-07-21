import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(
      { relations: { hospital: true, provider: true, city: true, sector: true } as never, order: { createdAt: 'DESC' } },
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id, { hospital: true, provider: true, city: true, sector: true } as never);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
