import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';
import { JwtPayload } from '../auth/jwt.strategy';
import { LatencyRulesService } from './latency-rules.service';
import { LatencyService } from './latency.service';
import {
  CreateLatencyRecipientDto,
  CreateLatencyRuleDto,
  UpdateLatencyRecipientDto,
  UpdateLatencyRuleDto,
} from './dto/latency.dto';

@Controller('latency-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LatencyRulesController {
  constructor(private readonly rulesService: LatencyRulesService) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cityId') cityId?: string,
    @Query('q') q?: string,
  ) {
    return this.rulesService.listRules(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      cityId,
      q,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findOne(@Param('id') id: string) {
    return this.rulesService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateLatencyRuleDto) {
    return this.rulesService.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateLatencyRuleDto) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.rulesService.remove(id);
  }
}

@Controller('latency-recipients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LatencyRecipientsController {
  constructor(private readonly rulesService: LatencyRulesService) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('ruleId') ruleId?: string,
    @Query('q') q?: string,
  ) {
    return this.rulesService.findRecipients(
      ruleId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      q,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findOne(@Param('id') id: string) {
    return this.rulesService.findRecipient(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateLatencyRecipientDto) {
    return this.rulesService.createRecipient(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateLatencyRecipientDto) {
    return this.rulesService.updateRecipient(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.rulesService.removeRecipient(id);
  }
}

@Controller('latency-breaches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LatencyBreachesController {
  constructor(private readonly latencyService: LatencyService) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('role') role?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.latencyService.findAllRecords(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
      { name, email, role, from, to },
    );
  }
}

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly latencyService: LatencyService) {}

  @Post('heartbeat')
  heartbeat(@Req() req: { user: JwtPayload }) {
    return this.latencyService.recordHeartbeat(req.user.sub).then(() => ({ ok: true }));
  }
}
