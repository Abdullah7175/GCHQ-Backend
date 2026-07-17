import { Controller, Post, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { SeedService } from './seed.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('seed')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  async run() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      throw new ForbiddenException('Seed endpoint is disabled in production');
    }
    await this.seedService.seed();
    return { message: 'Seed completed' };
  }

  @Post('demo')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  async refreshDemo(@Query('cityCode') cityCode?: string) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      throw new ForbiddenException('Seed endpoint is disabled in production');
    }
    const code = (cityCode || 'LHE').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
    return this.seedService.refreshDemoData(code);
  }
}
