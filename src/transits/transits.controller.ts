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
import { CreateTransitDto, UpdateTransitDto } from './dto/transit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { resolveCityId } from '../common/utils/city-scope';
import { TransitsQueryDto } from './dto/transits-query.dto';

@Controller('transits')
@UseGuards(JwtAuthGuard)
export class TransitsController {
  constructor(private readonly service: TransitsService) {}

  @Get()
  findAll(
    @Req() req: { user: JwtPayload },
    @Query() query: TransitsQueryDto,
  ) {
    const cityId = resolveCityId(req.user, query.cityId);
    if (query.hospitalId) return this.service.findByHospital(query.hospitalId);
    if (query.active === 'true') return this.service.findActive(cityId);
    if (query.paginated === 'true') {
      return this.service.findAllPaginated(cityId, query.page, query.limit);
    }
    return this.service.list(cityId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTransitDto) {
    return this.service.create(dto);
  }

  @Patch(':id/claim')
  claim(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.service.claim(
      id,
      req.user.sub,
      req.user.sectorId,
      req.user.isCityOverseer || req.user.role === 'admin',
    );
  }

  @Patch(':id/release')
  release(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.service.releaseGuidance(
      id,
      req.user.sub,
      req.user.isCityOverseer || req.user.role === 'admin',
    );
  }

  @Patch(':id/start')
  start(@Param('id') id: string, @Body() body: { currentLat?: number; currentLng?: number }) {
    return this.service.start(id, body.currentLat, body.currentLng);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id);
  }

  @Patch(':id/arrived')
  arrived(@Param('id') id: string) {
    return this.service.markArrived(id);
  }

  @Patch(':id/prep-ready')
  prepReady(@Param('id') id: string) {
    return this.service.setPrepReady(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransitDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
