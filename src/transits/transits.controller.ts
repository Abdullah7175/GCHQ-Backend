import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TransitsService } from './transits.service';
import { CreateTransitDto, UpdateTransitDto, UpdateTransitEtaDto } from './dto/transit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';
import { JwtPayload } from '../auth/jwt.strategy';
import { resolveCityId } from '../common/utils/city-scope';
import { TransitsQueryDto } from './dto/transits-query.dto';

@Controller('transits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransitsController {
  constructor(private readonly service: TransitsService) {}

  @Get()
  @RequirePermissions(Permission.READ_TRANSIT)
  findAll(
    @Req() req: { user: JwtPayload },
    @Query() query: TransitsQueryDto,
  ) {
    const cityId = resolveCityId(req.user, query.cityId);
    if (query.hospitalId) return this.service.findByHospital(query.hospitalId);
    if (query.paginated === 'true') {
      return this.service.findAllPaginated(cityId, query.page, query.limit, {
        ambulanceId: query.ambulanceId,
        status: query.status,
        from: query.from,
        to: query.to,
        activeOnly: query.active === 'true',
      });
    }
    if (query.active === 'true') return this.service.findActive(cityId);
    return this.service.list(cityId);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_TRANSIT)
  findOne(@Param('id') id: string) {
    return this.service.findCaseDetails(id);
  }

  @Post()
  @RequirePermissions(Permission.CREATE_TRANSIT)
  create(@Body() dto: CreateTransitDto, @Req() req: { user: JwtPayload }) {
    return this.service.create(dto, req.user);
  }

  @Patch(':id/claim')
  @RequirePermissions(Permission.CLAIM_TRANSIT)
  claim(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.service.claim(
      id,
      req.user.sub,
      req.user.sectorId,
      req.user.isCityOverseer || req.user.role === 'admin',
    );
  }

  @Patch(':id/release')
  @RequirePermissions(Permission.RELEASE_TRANSIT)
  release(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.service.releaseGuidance(
      id,
      req.user.sub,
      req.user.isCityOverseer || req.user.role === 'admin',
    );
  }

  @Patch(':id/start')
  @RequirePermissions(Permission.START_TRANSIT)
  start(
    @Param('id') id: string,
    @Body() body: { currentLat?: number; currentLng?: number },
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.start(id, body.currentLat, body.currentLng, req.user);
  }

  @Patch(':id/complete')
  @RequirePermissions(Permission.COMPLETE_TRANSIT)
  complete(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.service.complete(id, req.user);
  }

  @Patch(':id/arrived')
  @RequirePermissions(Permission.ARRIVE_TRANSIT)
  arrived(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.service.markArrived(id, req.user);
  }

  /** Driver app: overwrite live ETA (OSRM / blended). Same UUID as create/start. */
  @Patch(':id/eta')
  @RequirePermissions(Permission.UPDATE_ETA_TRANSIT)
  updateEta(
    @Param('id') id: string,
    @Body() dto: UpdateTransitEtaDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.updateEta(id, dto, req.user);
  }

  @Patch(':id/prep-ready')
  @RequirePermissions(Permission.PREP_READY_TRANSIT)
  prepReady(@Param('id') id: string) {
    return this.service.setPrepReady(id);
  }

  @Put(':id')
  @RequirePermissions(Permission.UPDATE_TRANSIT)
  update(@Param('id') id: string, @Body() dto: UpdateTransitDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_TRANSIT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

