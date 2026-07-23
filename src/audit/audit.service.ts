import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { parseDayBound } from '../common/utils/day-bounds';

export interface AuditRecord {
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  success?: boolean;
  durationMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(record: AuditRecord): Promise<void> {
    try {
      await this.auditRepo.insert({
        userId: record.userId ?? null,
        userEmail: record.userEmail?.slice(0, 254) ?? null,
        userRole: record.userRole?.slice(0, 40) ?? null,
        action: record.action.slice(0, 160),
        method: record.method?.slice(0, 10) ?? null,
        path: record.path?.slice(0, 500) ?? null,
        statusCode: record.statusCode ?? null,
        success: record.success ?? true,
        durationMs: record.durationMs ?? null,
        ipAddress: record.ipAddress?.slice(0, 64) ?? null,
        userAgent: record.userAgent?.slice(0, 1000) ?? null,
        latitude: record.latitude ?? null,
        longitude: record.longitude ?? null,
        metadata: (record.metadata ?? null) as never,
      });
    } catch (error) {
      // Auditing must never break the user operation it observes.
      this.logger.error(
        `Failed to persist ${record.action}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async findAll(
    page = 1,
    limit = 50,
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      name?: string;
      email?: string;
      role?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const query = this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .select([
        'audit',
        'user.id',
        'user.name',
        'user.email',
        'user.role',
      ])
      .orderBy('audit.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (filters.userId) query.andWhere('audit.userId = :userId', { userId: filters.userId });
    if (filters.action) {
      query.andWhere('audit.action ILIKE :action', { action: `%${filters.action}%` });
    }
    if (filters.resource) {
      query.andWhere(`audit.metadata ->> 'resource' = :resource`, { resource: filters.resource });
    }
    if (filters.name?.trim()) {
      query.andWhere('user.name ILIKE :name', { name: `%${filters.name.trim()}%` });
    }
    if (filters.email?.trim()) {
      query.andWhere(
        '(audit.userEmail ILIKE :email OR user.email ILIKE :email)',
        { email: `%${filters.email.trim()}%` },
      );
    }
    if (filters.role?.trim()) {
      query.andWhere(
        '(audit.userRole = :role OR user.role = :role)',
        { role: filters.role.trim() },
      );
    }
    if (filters.from) {
      query.andWhere('audit.createdAt >= :from', {
        from: parseDayBound(filters.from, false),
      });
    }
    if (filters.to) {
      query.andWhere('audit.createdAt <= :to', {
        to: parseDayBound(filters.to, true),
      });
    }

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }
}
