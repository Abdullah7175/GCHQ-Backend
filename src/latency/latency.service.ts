import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transit } from '../transits/transit.entity';
import { User } from '../users/user.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { UserRole } from '../common/enums';
import { LatencyBreachRule } from './latency-breach-rule.entity';
import { LatencyBreachRecipient } from './latency-breach-recipient.entity';
import { LatencyBreachRecord } from './latency-breach-record.entity';
import { LatencyNotification } from './latency-notification.entity';
import { UserPresence } from './user-presence.entity';
import {
  LatencyBreachType,
  LatencyNotificationStatus,
  LatencyNotifyChannel,
} from './latency.enums';
import { MessagingService } from '../messaging/messaging.service';
import { parseDayBound } from '../common/utils/day-bounds';

const PRESENCE_CHECK_MS = 60_000;
const NOTIFICATION_DISPATCH_MS = 30_000;

@Injectable()
export class LatencyService implements OnModuleInit {
  private readonly logger = new Logger(LatencyService.name);

  constructor(
    @InjectRepository(LatencyBreachRule)
    private readonly ruleRepo: Repository<LatencyBreachRule>,
    @InjectRepository(LatencyBreachRecipient)
    private readonly recipientRepo: Repository<LatencyBreachRecipient>,
    @InjectRepository(LatencyBreachRecord)
    private readonly recordRepo: Repository<LatencyBreachRecord>,
    @InjectRepository(LatencyNotification)
    private readonly notificationRepo: Repository<LatencyNotification>,
    @InjectRepository(UserPresence)
    private readonly presenceRepo: Repository<UserPresence>,
    @InjectRepository(Transit)
    private readonly transitRepo: Repository<Transit>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    private readonly messagingService: MessagingService,
  ) {}

  onModuleInit() {
    setInterval(() => {
      void this.checkUserPresenceBreaches();
    }, PRESENCE_CHECK_MS);
    setInterval(() => {
      void this.dispatchDueNotifications();
    }, NOTIFICATION_DISPATCH_MS);
  }

  computeEstimatedArrival(startedAt: Date, etaMinutes: number | null | undefined): Date | null {
    if (!startedAt || etaMinutes == null || !Number.isFinite(Number(etaMinutes))) return null;
    return new Date(startedAt.getTime() + Number(etaMinutes) * 60_000);
  }

  /** Remaining ETA from Google — deadline from now + remaining minutes */
  computeEstimatedArrivalFromRemaining(etaMinutes: number | null | undefined): Date | null {
    if (etaMinutes == null || !Number.isFinite(Number(etaMinutes))) return null;
    return new Date(Date.now() + Number(etaMinutes) * 60_000);
  }

  async evaluateTransitArrival(transit: Transit): Promise<LatencyBreachRecord | null> {
    const arrivalAt = transit.arrivedAt ?? transit.completedAt;
    const estimatedAt = transit.estimatedArrivalAt;
    if (!arrivalAt || !estimatedAt || !transit.cityId) return null;

    const rules = await this.ruleRepo.find({
      where: {
        breachType: LatencyBreachType.TRANSIT_ETA,
        cityId: transit.cityId,
        isActive: true,
      },
      relations: { recipients: true },
    });

    const applicable = rules.filter(
      (rule) => !rule.sectorId || rule.sectorId === transit.sectorId,
    );
    if (!applicable.length) return null;

    const rule = applicable.sort((a, b) => (a.sectorId ? -1 : 1))[0];
    const thresholdMs = rule.thresholdMinutes * 60_000;
    const deadlineMs = estimatedAt.getTime() + thresholdMs;

    if (arrivalAt.getTime() <= deadlineMs) return null;

    const existing = await this.recordRepo.findOne({
      where: {
        breachType: LatencyBreachType.TRANSIT_ETA,
        referenceType: 'transit',
        referenceId: transit.id,
      },
    });
    if (existing) return existing;

    const delayMinutes = (arrivalAt.getTime() - estimatedAt.getTime()) / 60_000;

    const record = await this.recordRepo.save({
      ruleId: rule.id,
      breachType: LatencyBreachType.TRANSIT_ETA,
      cityId: transit.cityId,
      sectorId: transit.sectorId,
      referenceType: 'transit',
      referenceId: transit.id,
      detectedAt: new Date(),
      expectedAt: estimatedAt,
      actualAt: arrivalAt,
      thresholdMinutes: rule.thresholdMinutes,
      delayMinutes: Number(delayMinutes.toFixed(2)),
      metadata: {
        transitId: transit.transitId,
        unitNumber: transit.ambulance?.unitNumber,
        hospitalName: transit.hospital?.name,
        etaMinutes: transit.etaMinutes,
      },
    });

    await this.queueNotifications(record, rule);
    this.logger.warn(
      `Transit ETA breach: ${transit.transitId} delayed ${delayMinutes.toFixed(1)} min (threshold ${rule.thresholdMinutes} min)`,
    );
    return record;
  }

  async recordHeartbeat(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const now = new Date();
    const existing = await this.presenceRepo.findOne({ where: { userId } });

    if (existing?.openBreachRecordId) {
      await this.skipPendingNotifications(existing.openBreachRecordId);
    }

    await this.presenceRepo.save({
      userId,
      lastHeartbeatAt: now,
      lastLoginAt: existing?.lastLoginAt ?? now,
      disconnectDetectedAt: null,
      openBreachRecordId: null,
    });
  }

  async recordUserLogin(userId: string): Promise<void> {
    const now = new Date();
    const existing = await this.presenceRepo.findOne({ where: { userId } });
    if (existing?.openBreachRecordId) {
      await this.skipPendingNotifications(existing.openBreachRecordId);
    }
    await this.presenceRepo.save({
      userId,
      lastHeartbeatAt: now,
      lastLoginAt: now,
      disconnectDetectedAt: null,
      openBreachRecordId: null,
    });
  }

  async checkUserPresenceBreaches(): Promise<void> {
    const rules = await this.ruleRepo.find({
      where: {
        breachType: LatencyBreachType.USER_PRESENCE,
        isActive: true,
      },
      relations: { recipients: true },
    });
    if (!rules.length) return;

    const monitoredRoles = [UserRole.HOSPITAL, UserRole.HQ_1122, UserRole.SAFE_CITY];
    const users = await this.userRepo.find({
      where: { role: In(monitoredRoles), isActive: true },
    });

    const now = Date.now();

    for (const user of users) {
      const userSectorIds = await this.resolveUserSectorIds(user);
      const matchingRules = rules.filter(
        (rule) =>
          rule.cityId === user.cityId &&
          rule.targetRole === user.role &&
          (!rule.sectorId || userSectorIds.includes(rule.sectorId)),
      );
      if (!matchingRules.length) continue;

      const presence = await this.presenceRepo.findOne({ where: { userId: user.id } });
      const lastSeen = presence?.lastHeartbeatAt ?? presence?.lastLoginAt;

      for (const rule of matchingRules) {
        const thresholdMs = rule.thresholdMinutes * 60_000;

        if (!lastSeen) {
          await this.maybeCreateUserBreach(user, rule, null, now, presence);
          continue;
        }

        if (now - lastSeen.getTime() <= thresholdMs) {
          if (presence?.openBreachRecordId) {
            await this.skipPendingNotifications(presence.openBreachRecordId);
            await this.presenceRepo.update(user.id, {
              disconnectDetectedAt: null,
              openBreachRecordId: null,
            });
          }
          continue;
        }

        if (presence && !presence.disconnectDetectedAt) {
          await this.presenceRepo.update(user.id, {
            disconnectDetectedAt: new Date(lastSeen.getTime() + thresholdMs),
          });
        }

        await this.maybeCreateUserBreach(user, rule, lastSeen, now, presence);
      }
    }
  }

  private async maybeCreateUserBreach(
    user: User,
    rule: LatencyBreachRule,
    lastSeen: Date | null,
    nowMs: number,
    presence: UserPresence | null,
  ): Promise<void> {
    if (presence?.openBreachRecordId) return;

    const sectorId = rule.sectorId ?? (await this.resolveUserSectorIds(user))[0] ?? null;
    const delayMinutes = lastSeen
      ? (nowMs - lastSeen.getTime()) / 60_000
      : rule.thresholdMinutes;

    const record = await this.recordRepo.save({
      ruleId: rule.id,
      breachType: LatencyBreachType.USER_PRESENCE,
      cityId: rule.cityId,
      sectorId,
      referenceType: 'user',
      referenceId: user.id,
      detectedAt: new Date(),
      expectedAt: lastSeen,
      actualAt: new Date(),
      thresholdMinutes: rule.thresholdMinutes,
      delayMinutes: Number(delayMinutes.toFixed(2)),
      metadata: {
        userId: user.id,
        userEmail: user.email,
        userName: user.name || user.email,
        userRole: user.role,
        lastSeenAt: lastSeen?.toISOString() ?? null,
      },
    });

    await this.presenceRepo.save({
      userId: user.id,
      lastHeartbeatAt: presence?.lastHeartbeatAt ?? lastSeen ?? new Date(0),
      lastLoginAt: presence?.lastLoginAt ?? null,
      disconnectDetectedAt: presence?.disconnectDetectedAt ?? new Date(),
      openBreachRecordId: record.id,
    });

    await this.queueNotifications(record, rule);
    this.logger.warn(
      `User presence breach: ${user.name || user.email} (${user.role}) offline > ${rule.thresholdMinutes} min`,
    );
  }

  private async resolveUserSectorIds(user: User): Promise<string[]> {
    if (user.role === UserRole.SAFE_CITY || user.role === UserRole.HQ_1122) {
      if (user.permittedSectorIds?.length) return user.permittedSectorIds;
      return user.sectorId ? [user.sectorId] : [];
    }
    if (user.role === UserRole.HOSPITAL && user.hospitalId) {
      const hospital = await this.hospitalRepo.findOne({ where: { id: user.hospitalId } });
      return hospital?.sectorId ? [hospital.sectorId] : [];
    }
    return user.sectorId ? [user.sectorId] : [];
  }

  private async queueNotifications(
    record: LatencyBreachRecord,
    rule: LatencyBreachRule,
  ): Promise<void> {
    const recipients =
      rule.recipients?.filter((r) => r.isActive) ??
      (await this.recipientRepo.find({ where: { ruleId: rule.id, isActive: true } }));

    const now = Date.now();

    for (const recipient of recipients) {
      const channels =
        recipient.channel === LatencyNotifyChannel.BOTH
          ? [LatencyNotifyChannel.SMS, LatencyNotifyChannel.WHATSAPP]
          : [recipient.channel];

      const maxAttempts = Math.min(10, Math.max(1, Number(recipient.notificationCount) || 1));
      const intervalMinutes = Math.min(
        24 * 60,
        Math.max(1, Number(recipient.notificationIntervalMinutes) || 15),
      );

      for (const channel of channels) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const scheduledAt =
            attempt === 1
              ? new Date(now)
              : new Date(now + (attempt - 1) * intervalMinutes * 60_000);

          const notification = await this.notificationRepo.save({
            breachRecordId: record.id,
            recipientId: recipient.id,
            name: recipient.name,
            phone: recipient.phone,
            channel,
            status: LatencyNotificationStatus.PENDING,
            attemptNumber: attempt,
            maxAttempts,
            scheduledAt,
          });

          if (attempt === 1) {
            await this.dispatchNotification(notification, record);
          }
        }
      }
    }
  }

  /** Send scheduled follow-up notifications (attempt 2+) whose scheduled_at has arrived. */
  async dispatchDueNotifications(): Promise<void> {
    const now = new Date();
    const due = await this.notificationRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.breachRecord', 'breachRecord')
      .where('n.status = :status', { status: LatencyNotificationStatus.PENDING })
      .andWhere('n.attempt_number > 1')
      .andWhere('(n.scheduled_at IS NULL OR n.scheduled_at <= :now)', { now })
      .orderBy('n.scheduled_at', 'ASC')
      .take(50)
      .getMany();

    for (const notification of due) {
      const record =
        notification.breachRecord ??
        (await this.recordRepo.findOne({ where: { id: notification.breachRecordId } }));
      if (!record) {
        await this.notificationRepo.update(notification.id, {
          status: LatencyNotificationStatus.SKIPPED,
          providerResponse: 'Breach record missing',
        });
        continue;
      }

      // For ongoing user-offline breaches, skip follow-ups once the user is back online.
      if (record.breachType === LatencyBreachType.USER_PRESENCE) {
        const presence = await this.presenceRepo.findOne({
          where: { openBreachRecordId: record.id },
        });
        if (!presence) {
          await this.notificationRepo.update(notification.id, {
            status: LatencyNotificationStatus.SKIPPED,
            providerResponse: 'User returned online — follow-up cancelled',
          });
          continue;
        }
      }

      await this.dispatchNotification(notification, record);
    }
  }

  private async skipPendingNotifications(breachRecordId: string): Promise<void> {
    await this.notificationRepo.update(
      {
        breachRecordId,
        status: LatencyNotificationStatus.PENDING,
      },
      {
        status: LatencyNotificationStatus.SKIPPED,
        providerResponse: 'User returned online — remaining alerts cancelled',
      },
    );
  }

  private async dispatchNotification(
    notification: LatencyNotification,
    record: LatencyBreachRecord,
  ): Promise<void> {
    const breachLabel =
      record.breachType === LatencyBreachType.TRANSIT_ETA
        ? 'Ambulance ETA breach'
        : 'User offline breach';
    const meta = record.metadata ?? {};
    const detail =
      typeof meta.transitId === 'string'
        ? `Case ${meta.transitId}`
        : typeof meta.userName === 'string'
          ? `User ${meta.userName}`
          : typeof meta.userEmail === 'string'
            ? `User ${meta.userEmail}`
            : record.referenceType;
    const attemptSuffix =
      notification.maxAttempts > 1
        ? ` Alert ${notification.attemptNumber}/${notification.maxAttempts}.`
        : '';
    const message = `[GCHQ] ${breachLabel}: ${detail}. Delay ${record.delayMinutes} min (threshold ${record.thresholdMinutes} min).${attemptSuffix}`;

    const result = await this.messagingService.sendForChannel(
      notification.channel as LatencyNotifyChannel,
      notification.phone,
      message,
    );

    await this.notificationRepo.update(notification.id, {
      status: result.ok ? LatencyNotificationStatus.SENT : LatencyNotificationStatus.FAILED,
      providerResponse: result.responseBody || result.error || null,
      sentAt: result.ok ? new Date() : null,
    });
  }

  async countBreachesForCityToday(cityId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.recordRepo
      .createQueryBuilder('r')
      .where('r.city_id = :cityId', { cityId })
      .andWhere('r.detected_at >= :start', { start })
      .getCount();
  }

  async listRecentBreachesForCity(cityId: string, limit = 20) {
    return this.recordRepo.find({
      where: { cityId },
      relations: { sector: true, rule: true },
      order: { detectedAt: 'DESC' },
      take: limit,
    });
  }

  /** ETA breach records linked to a transit (referenceType=transit). */
  async findTransitEtaBreaches(transitId: string): Promise<LatencyBreachRecord[]> {
    return this.recordRepo.find({
      where: {
        breachType: LatencyBreachType.TRANSIT_ETA,
        referenceType: 'transit',
        referenceId: transitId,
      },
      relations: { rule: true, sector: true },
      order: { detectedAt: 'DESC' },
    });
  }

  async findAllRecords(
    page = 1,
    limit = 50,
    filters: {
      name?: string;
      email?: string;
      role?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const query = this.recordRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.rule', 'rule')
      .leftJoinAndSelect('r.city', 'city')
      .leftJoinAndSelect('r.sector', 'sector')
      .leftJoinAndSelect('r.notifications', 'notifications')
      .orderBy('r.detectedAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (filters.name?.trim()) {
      query.andWhere(
        `(r.metadata ->> 'userName' ILIKE :name OR r.metadata ->> 'unitNumber' ILIKE :name OR r.metadata ->> 'transitId' ILIKE :name)`,
        { name: `%${filters.name.trim()}%` },
      );
    }
    if (filters.email?.trim()) {
      query.andWhere(`r.metadata ->> 'userEmail' ILIKE :email`, {
        email: `%${filters.email.trim()}%`,
      });
    }
    if (filters.role?.trim()) {
      query.andWhere(`r.metadata ->> 'userRole' = :role`, {
        role: filters.role.trim(),
      });
    }
    if (filters.from) {
      query.andWhere('r.detectedAt >= :from', {
        from: parseDayBound(filters.from, false),
      });
    }
    if (filters.to) {
      query.andWhere('r.detectedAt <= :to', {
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
