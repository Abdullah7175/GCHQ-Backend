import { Controller, Get, Query, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';
import { JwtPayload } from '../auth/jwt.strategy';
import { requireCityId, resolveCityId } from '../common/utils/city-scope';
import { UsersService } from '../users/users.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly usersService: UsersService,
  ) {}

  @Get('hospital')
  @RequirePermissions(Permission.VIEW_DASHBOARD_HOSPITAL)
  async getHospital(@Req() req: { user: JwtPayload }, @Query('hospitalId') queryHospitalId?: string) {
    let hospitalId = queryHospitalId || req.user.hospitalId;
    if (!hospitalId) {
      const user = await this.usersService.findOne(req.user.sub, { hospital: true } as never);
      hospitalId = user.hospitalId ?? undefined;
    }
    if (!hospitalId) {
      throw new BadRequestException('Select a hospital to view this dashboard.');
    }
    return this.service.getHospitalDashboard(hospitalId);
  }

  @Get('safe-city')
  @RequirePermissions(Permission.VIEW_DASHBOARD_SAFE_CITY)
  async getSafeCity(@Req() req: { user: JwtPayload }, @Query('cityId') cityId?: string) {
    const user = await this.usersService.findOne(req.user.sub);
    return this.service.getSafeCityDashboard(requireCityId(req.user, cityId), user.permittedProviderIds ?? undefined);
  }

  @Get('hq')
  @RequirePermissions(Permission.VIEW_DASHBOARD_HQ)
  async getHq(@Req() req: { user: JwtPayload }, @Query('cityId') cityId?: string) {
    const user = await this.usersService.findOne(req.user.sub);
    return this.service.getHqDashboard(requireCityId(req.user, cityId), {
      sectorId: req.user.sectorId,
      isCityOverseer: req.user.isCityOverseer || req.user.role === 'admin',
      permittedProviderIds: user.permittedProviderIds ?? undefined,
    });
  }

  @Get('vvip')
  @RequirePermissions(Permission.VIEW_DASHBOARD_VVIP)
  getVvip(@Req() req: { user: JwtPayload }, @Query('cityId') cityId?: string) {
    return this.service.getVvipDashboard(resolveCityId(req.user, cityId));
  }
}

