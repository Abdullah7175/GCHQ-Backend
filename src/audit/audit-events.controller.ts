import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from './audit.service';
import { CreateAuditEventDto } from './audit-event.dto';

@Controller('audit-events')
@UseGuards(JwtAuthGuard)
export class AuditEventsController {
  constructor(private readonly audit: AuditService) {}

  @Post()
  @HttpCode(202)
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: CreateAuditEventDto,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    await this.audit.record({
      userId: req.user.sub,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: `client.${dto.action}`,
      method: 'CLIENT',
      path: null,
      statusCode: 202,
      success: true,
      ipAddress: ip || req.ip || req.socket.remoteAddress || null,
      userAgent: req.get('user-agent') ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      metadata: dto.metadata ?? null,
    });
    return { accepted: true };
  }
}
