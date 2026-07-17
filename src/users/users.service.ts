import {
  Injectable,
  Logger,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import { CreateUserDto, UpdateUserDto, LoginDto } from './dto/user.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { sanitizeUser } from '../common/security/sanitize';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class UsersService extends BaseCrudService<User> {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {
    super(userRepo);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 12);
    const created = await super.create({ ...dto, password: hashed } as Partial<User>);
    return sanitizeUser(created as unknown as Record<string, unknown>) as unknown as User;
  }

  findAll(options?: any, page?: number, limit?: number) {
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

  async findOne(id: string, relations?: any): Promise<User> {
    const user = await super.findOne(id, relations);
    return sanitizeUser(user as unknown as Record<string, unknown>) as unknown as User;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const data: Partial<User> = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
      // Invalidate outstanding sessions after password change
      const current = await this.userRepo.findOne({ where: { id } });
      if (current) data.tokenVersion = (current.tokenVersion ?? 0) + 1;
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

    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    this.logger.log(`Login success: ${email} (${user.role})`);

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      cityId: user.cityId,
      hospitalId: user.hospitalId,
      providerId: user.providerId,
      sectorId: user.sectorId,
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

  /** Invalidate all outstanding JWTs for this user (logout everywhere for this account). */
  async logout(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    await this.userRepo.update(userId, {
      tokenVersion: (user.tokenVersion ?? 0) + 1,
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
}
