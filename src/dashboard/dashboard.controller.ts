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
    const user = await this.usersService.findOne(req.user.sub, { sector: true } as never);
    return this.service.getSafeCityDashboard(requireCityId(req.user, cityId), {
      permittedProviderIds: user.permittedProviderIds ?? undefined,
      sectorIds:
        user.permittedSectorIds && user.permittedSectorIds.length > 0
          ? user.permittedSectorIds
          : user.sectorId
            ? [user.sectorId]
            : undefined,
    });
  }

  @Get('hq')
  @RequirePermissions(Permission.VIEW_DASHBOARD_HQ)
  async getHq(@Req() req: { user: JwtPayload }, @Query('cityId') cityId?: string) {
    const user = await this.usersService.findOne(req.user.sub);
    return this.service.getHqDashboard(requireCityId(req.user, cityId), {
      sectorIds:
        user.permittedSectorIds && user.permittedSectorIds.length > 0
          ? user.permittedSectorIds
          : user.sectorId
            ? [user.sectorId]
            : undefined,
      isCityOverseer: user.isCityOverseer || req.user.role === 'admin',
      permittedProviderIds: user.permittedProviderIds ?? undefined,
    });
  }

  @Get('vvip')
  @RequirePermissions(Permission.VIEW_DASHBOARD_VVIP)
  async getVvip(@Req() req: { user: JwtPayload }, @Query('cityId') cityId?: string) {
    const user = await this.usersService.findOne(req.user.sub);
    // City-assigned VVIP must stay in their city; unassigned VVIP/admin can overview
    const resolved = user.cityId
      ? requireCityId(req.user, cityId)
      : resolveCityId(req.user, cityId);
    return this.service.getVvipDashboard(resolved, user.permittedProviderIds ?? undefined);
  }
}

