import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  buildAuditMetadata,
  resolveAuditAction,
  shouldAuditRequest,
} from './audit-action.util';
import { AuditService } from './audit.service';

type AuditedRequest = Request & {
  user?: JwtPayload;
  body?: Record<string, unknown>;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = (request.originalUrl || request.url || '').split('?')[0];

    if (!shouldAuditRequest(request.method, path)) {
      return next.handle();
    }

    const startedAt = Date.now();

    const persist = (
      success: boolean,
      statusCode: number,
      responseBody?: unknown,
    ) => {
      const responseUser = (
        responseBody as { user?: { id?: string; email?: string; role?: string } }
      )?.user;
      const body = request.body ?? {};
      const latitude = this.coordinate(body.latitude ?? body.currentLat);
      const longitude = this.coordinate(body.longitude ?? body.currentLng);
      const action = resolveAuditAction(request.method, path, success);

      void this.audit.record({
        userId: request.user?.sub ?? responseUser?.id ?? null,
        userEmail:
          request.user?.email ??
          responseUser?.email ??
          (path.endsWith('/auth/login') ? String(body.email || '') : null),
        userRole: request.user?.role ?? responseUser?.role ?? null,
        action,
        method: request.method,
        path,
        statusCode,
        success,
        durationMs: Date.now() - startedAt,
        ipAddress: this.clientIp(request),
        userAgent: request.get('user-agent') ?? null,
        latitude,
        longitude,
        metadata: buildAuditMetadata({
          method: request.method,
          path,
          params: request.params ?? {},
          query: request.query as Record<string, unknown>,
          body,
        }),
      });
    };

    return next.handle().pipe(
      tap({
        next: (value) => persist(true, response.statusCode, value),
        error: (error: { status?: number; statusCode?: number }) =>
          persist(
            false,
            Number(error?.status ?? error?.statusCode ?? response.statusCode ?? 500),
          ),
      }),
    );
  }

  private clientIp(request: Request): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return value?.split(',')[0]?.trim() || request.ip || request.socket.remoteAddress || null;
  }

  private coordinate(value: unknown): number | null {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
}
