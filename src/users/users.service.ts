import {
  Injectable,
  Logger,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import { Sector } from '../sectors/sector.entity';
import { CreateUserDto, UpdateUserDto, LoginDto } from './dto/user.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { sanitizeUser } from '../common/security/sanitize';
import { UserRole } from '../common/enums';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { LatencyService } from '../latency/latency.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class UsersService extends BaseCrudService<User> {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
    private readonly latencyService: LatencyService,
  ) {
    super(userRepo);
  }

  async create(dto: CreateUserDto): Promise<User> {
    await this.validateUserScope(dto);
    const normalized = this.normalizeOpsScopes({ ...dto } as Partial<User>, dto.role);
    const hashed = await bcrypt.hash(dto.password, 12);
    const created = await super.create({ ...normalized, password: hashed } as Partial<User>);
    return sanitizeUser(created as unknown as Record<string, unknown>) as unknown as User;
  }

  findAll(options?: any, page?: number, limit?: number, q?: string, role?: string) {
    if (!q?.trim() && !role?.trim()) {
      return super.findAll(
        {
          ...options,
          relations: { hospital: true, provider: true, city: true, sector: true } as never,
          order: { createdAt: 'DESC' },
        },
        page,
        limit,
      ).then(async (result) => {
        if (Array.isArray(result)) {
          return result.map((u) => sanitizeUser(u as unknown as Record<string, unknown>));
        }
        return {
          ...result,
          data: result.data.map((u) => sanitizeUser(u as unknown as Record<string, unknown>)),
        };
      }) as never;
    }

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.hospital', 'hospital')
      .leftJoinAndSelect('u.provider', 'provider')
      .leftJoinAndSelect('u.city', 'city')
      .leftJoinAndSelect('u.sector', 'sector')
      .orderBy('u.createdAt', 'DESC');

    if (role?.trim()) qb.andWhere('u.role = :role', { role: role.trim() });
    if (q?.trim()) {
      qb.andWhere('(u.name ILIKE :q OR u.email ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    return (async () => {
      if (page && limit) {
        const [data, total] = await qb
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount();
        return {
          data: data.map((u) => sanitizeUser(u as unknown as Record<string, unknown>)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        };
      }
      const data = await qb.getMany();
      return data.map((u) => sanitizeUser(u as unknown as Record<string, unknown>));
    })() as never;
  }

  async findOne(id: string, relations?: any): Promise<User> {
    const user = await super.findOne(id, relations);
    return sanitizeUser(user as unknown as Record<string, unknown>) as unknown as User;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { id } });
    if (!existing) throw new BadRequestException('User not found');
    await this.validateUserScope(dto, existing);
    const data: Partial<User> = { ...dto };
    const role = (dto.role ?? existing.role) as UserRole;
    Object.assign(data, this.normalizeOpsScopes(data, role));
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
      data.tokenVersion = (existing.tokenVersion ?? 0) + 1;
    }
    const updated = await super.update(id, data);
    return sanitizeUser(updated as unknown as Record<string, unknown>) as unknown as User;
  }

  /** Unassign driver + clear claims, then delete user (avoids ambulance/transit FK errors). */
  async remove(id: string): Promise<void> {
    await this.userRepo.findOneOrFail({ where: { id } });
    await this.userRepo.manager.transaction(async (em) => {
      await em.update(Ambulance, { driverId: id }, { driverId: null });
      await em.update(Transit, { claimedById: id }, { claimedById: null, claimedAt: null });
      await em.delete(User, { id });
    });
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email },
      relations: { hospital: true, provider: true, city: true, sector: true } as never,
    });

    // Constant-looking failure path (OWASP A07 — credential stuffing)
    if (!user || !user.isActive) {
      await this.dummyCompare(dto.password);
      this.logger.warn(`Login failed (unknown or inactive account): ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      this.logger.warn(`Login blocked (account locked): ${email}, ${minutes} min remaining`);
      throw new HttpException(
        `Account temporarily locked. Try again in ${minutes} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      const patch: Partial<User> = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        patch.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        patch.failedLoginAttempts = 0;
        this.logger.warn(`Account locked for ${LOCK_MINUTES} min after ${attempts} failures: ${email}`);
      } else {
        this.logger.warn(`Login failed (wrong password, attempt ${attempts}/${MAX_FAILED_ATTEMPTS}): ${email}`);
      }
      await this.userRepo.update(user.id, patch);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === UserRole.PARAMEDIC) {
      user.tokenVersion = await this.activateDriverSession(user);
    } else {
      await this.userRepo.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }
    this.logger.log(`Login success: ${email} (${user.role})`);

    if (
      user.role === UserRole.HOSPITAL ||
      user.role === UserRole.HQ_1122 ||
      user.role === UserRole.SAFE_CITY
    ) {
      await this.latencyService.recordUserLogin(user.id);
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      cityId: user.cityId,
      hospitalId: user.hospitalId,
      providerId: user.providerId,
      sectorId: user.sectorId,
      permittedSectorIds: user.permittedSectorIds ?? undefined,
      isCityOverseer: user.isCityOverseer,
      tokenVersion: user.tokenVersion ?? 0,
    });

    return {
      user: sanitizeUser(user as unknown as Record<string, unknown>),
      accessToken: token,
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      tokenType: 'Bearer',
    };
  }

  /**
   * Atomically assigns the ambulance shift to this driver and revokes the
   * previous driver's JWT. A fresh login by the same driver also replaces
   * that driver's older device session.
   */
  private async activateDriverSession(user: User): Promise<number> {
    let revokedUserId: string | null = null;
    let activeAmbulance: {
      id: string;
      unitNumber: string;
      latitude: number | null;
      longitude: number | null;
    } | null = null;
    const tokenVersion = await this.userRepo.manager.transaction(async (em) => {
      const ambulance = await em
        .getRepository(Ambulance)
        .createQueryBuilder('ambulance')
        .innerJoin(
          'ambulance.assignedDrivers',
          'assignedDriver',
          'assignedDriver.id = :userId',
          { userId: user.id },
        )
        .setLock('pessimistic_write')
        .getOne();

      if (!ambulance) {
        throw new UnauthorizedException(
          'No ambulance is assigned to this driver account',
        );
      }

      revokedUserId = ambulance.driverId;
      activeAmbulance = {
        id: ambulance.id,
        unitNumber: ambulance.unitNumber,
        latitude: ambulance.currentLat != null ? Number(ambulance.currentLat) : null,
        longitude: ambulance.currentLng != null ? Number(ambulance.currentLng) : null,
      };
      if (ambulance.driverId && ambulance.driverId !== user.id) {
        await em.increment(User, { id: ambulance.driverId }, 'tokenVersion', 1);
      }

      const lockedUser = await em.findOne(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedUser) throw new UnauthorizedException();
      const nextVersion = (lockedUser.tokenVersion ?? 0) + 1;
      await em.update(User, user.id, {
        tokenVersion: nextVersion,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      await em.update(Ambulance, ambulance.id, { driverId: user.id });
      return nextVersion;
    });
    const ambulanceAudit = activeAmbulance as {
      id: string;
      unitNumber: string;
      latitude: number | null;
      longitude: number | null;
    } | null;

    if (revokedUserId) {
      this.events.forceLogoutUser(
        revokedUserId,
        revokedUserId === user.id
          ? 'This driver account was signed in on another device'
          : 'Another assigned driver started this ambulance shift',
      );
      void this.audit.record({
        userId: revokedUserId,
        action: 'driver.shift.revoked',
        success: true,
        latitude: ambulanceAudit?.latitude ?? null,
        longitude: ambulanceAudit?.longitude ?? null,
        metadata: {
          ambulanceId: ambulanceAudit?.id,
          unitNumber: ambulanceAudit?.unitNumber,
          replacementDriverId: user.id,
        },
      });
    }
    void this.audit.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'driver.shift.started',
      success: true,
      latitude: ambulanceAudit?.latitude ?? null,
      longitude: ambulanceAudit?.longitude ?? null,
      metadata: {
        ambulanceId: ambulanceAudit?.id,
        unitNumber: ambulanceAudit?.unitNumber,
      },
    });
    return tokenVersion;
  }

  /** Invalidate all outstanding JWTs for this user (logout everywhere for this account). */
  async logout(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    await this.userRepo.manager.transaction(async (em) => {
      await em.update(Ambulance, { driverId: userId }, { driverId: null });
      await em.update(User, userId, {
        tokenVersion: (user.tokenVersion ?? 0) + 1,
      });
    });
    this.logger.log(`Logout (tokens revoked): ${user.email}`);
    return { message: 'Logged out successfully' };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { apiKey },
      relations: { hospital: true, provider: true, city: true, sector: true } as never,
    });
  }

  /** Used by JWT strategy — returns raw entity including tokenVersion. */
  async findRawById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  private async dummyCompare(password: string) {
    await bcrypt.compare(password, '$2b$12$invalidhashfortimingpadxxxxxxxxxxxxuG8G8G8G8G8G8G8G8G');
  }

  private async validateUserScope(
    dto: CreateUserDto | UpdateUserDto,
    existing?: User,
  ): Promise<void> {
    const role = (dto.role ?? existing?.role) as UserRole;
    const cityId = dto.cityId ?? existing?.cityId ?? null;
    const sectorId = dto.sectorId !== undefined ? dto.sectorId : existing?.sectorId ?? null;
    const permittedSectorIds = dto.permittedSectorIds ?? existing?.permittedSectorIds ?? null;
    const hospitalId = dto.hospitalId ?? existing?.hospitalId ?? null;
    const providerId = dto.providerId ?? existing?.providerId ?? null;

    const cityBoundRoles = [
      UserRole.HOSPITAL,
      UserRole.PARAMEDIC,
      UserRole.HQ_1122,
      UserRole.SAFE_CITY,
      UserRole.VVIP,
    ];

    if (cityBoundRoles.includes(role) && !cityId) {
      throw new BadRequestException('City is required for this role');
    }

    if (role === UserRole.HOSPITAL && !hospitalId) {
      throw new BadRequestException('Hospital is required for Hospital ER Staff');
    }

    if (role === UserRole.PARAMEDIC && !providerId) {
      throw new BadRequestException('Fleet provider is required for Paramedic / Driver');
    }

    if (role === UserRole.SAFE_CITY || role === UserRole.HQ_1122) {
      if (!permittedSectorIds || permittedSectorIds.length === 0) {
        throw new BadRequestException(
          role === UserRole.HQ_1122
            ? 'At least one sector is required for HQ user'
            : 'At least one sector is required for Safe City Controller',
        );
      }
      await this.assertSectorsInCity(permittedSectorIds, cityId!);
    }

    if (role === UserRole.VVIP && sectorId) {
      await this.assertSectorInCity(sectorId, cityId!);
    }
  }

  private async assertSectorInCity(sectorId: string, cityId: string): Promise<void> {
    const sector = await this.userRepo.manager.findOne(Sector, {
      where: { id: sectorId },
    });
    if (!sector) {
      throw new BadRequestException('Selected sector does not exist');
    }
    if (sector.cityId !== cityId) {
      throw new BadRequestException('Sector must belong to the selected city');
    }
  }

  private async assertSectorsInCity(sectorIds: string[], cityId: string): Promise<void> {
    for (const sectorId of [...new Set(sectorIds)]) {
      await this.assertSectorInCity(sectorId, cityId);
    }
  }

  private normalizeOpsScopes(data: Partial<User>, role: UserRole): Partial<User> {
    const opsRoles = [UserRole.HQ_1122, UserRole.SAFE_CITY, UserRole.VVIP];
    if (!opsRoles.includes(role)) {
      return { ...data, sectorId: null, permittedSectorIds: null };
    }

    const permittedSectorIds = Array.isArray(data.permittedSectorIds)
      ? [...new Set(data.permittedSectorIds.filter(Boolean))]
      : data.permittedSectorIds;

    if (role === UserRole.SAFE_CITY || role === UserRole.HQ_1122) {
      return {
        ...data,
        permittedSectorIds: permittedSectorIds ?? null,
        sectorId:
          Array.isArray(permittedSectorIds) && permittedSectorIds.length > 0
            ? permittedSectorIds[0]
            : null,
      };
    }

    return {
      ...data,
      permittedSectorIds: null,
    };
  }
}
