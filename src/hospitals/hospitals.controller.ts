import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import {
  CreateHospitalDto,
  SuitableHospitalsQueryDto,
  UpdateHospitalDto,
} from './dto/hospital.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';
import { JwtPayload } from '../auth/jwt.strategy';
import { requireCityId, resolveCityId } from '../common/utils/city-scope';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HospitalsController {
  constructor(private readonly service: HospitalsService) {}

  @Get()
  findAll(
    @Req() req: { user: JwtPayload },
    @Query('cityId') requestedCityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cityId = resolveCityId(req.user, requestedCityId);
    return this.service.findByCity(
      cityId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  /** Web/mobile map: every hospital in the scoped city as a red-plus marker. */
  @Get('map-markers')
  findMapMarkers(
    @Req() req: { user: JwtPayload },
    @Query('cityId') requestedCityId?: string,
  ) {
    const cityId = requireCityId(req.user, requestedCityId);
    return this.service.findMapMarkers(cityId);
  }

  /** Driver app: all city hospitals nearest-first, with capability/recommendation flags. */
  @Get('suitable')
  findSuitable(
    @Req() req: { user: JwtPayload },
    @Query() query: SuitableHospitalsQueryDto,
  ) {
    const cityId = requireCityId(req.user, query.cityId);
    return this.service.findSuitable(
      cityId,
      query.emergencyTypeId,
      query.latitude,
      query.longitude,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateHospitalDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

